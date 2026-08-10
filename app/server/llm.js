// LLM seam. Vertex AI Gemini, authenticated by Application Default Credentials
// — there is no API key anywhere in this file or in config.json, which is the
// point: the Groq key had to live in a file that must never be committed.
//
// Dev: ADC from `gcloud auth application-default login` (app/gcp-setup.md).
// Prod: the Cloud Run metadata server, same code path below.
//
// Cost guardrails per built-in-chat-plan.md: Gemini 3.x models think by
// default and thinking bills as output, which turns a $15 semester into ~$120.
// thinkingBudget is therefore set explicitly on every call — never left to the
// model's default. Measured 2026-08-05: one trivial question on 3.5 Flash spent
// 316 thinking tokens against 5 output tokens.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { vertexTarget, config } = require('./school');
const { col } = require('./store');

const DEFAULT_CHAT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_ANALYSIS_MODEL = 'gemini-3.1-flash-lite';

const MAX_CHAT_TOKENS = 500;
const MAX_EVAL_TOKENS = 400;

// Both zero, including analysis — the plan called for a *capped* analysis
// budget, but measurement on 2026-08-05 showed thinkingBudget is advisory, not
// a cap: 3.5 Flash asked for 512 spent 777. Zero is the only setting that
// actually holds, so the choice is thinking-off or thinking-uncapped, and
// uncapped is the ~$120 semester. See the model note in app/README.md.
const CHAT_THINKING_BUDGET = 0;
const ANALYSIS_THINKING_BUDGET = 0;

const ADC_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');

const METADATA_HOST = process.env.GCE_METADATA_HOST || 'metadata.google.internal';

// ---------- credentials ----------

let tokenCache = null;

async function mintToken() {
  if (fs.existsSync(ADC_PATH)) {
    const adc = JSON.parse(fs.readFileSync(ADC_PATH, 'utf8'));
    if (adc.type !== 'authorized_user') {
      throw new Error(`Unsupported credential type "${adc.type}" at ${ADC_PATH}`);
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: adc.client_id,
        client_secret: adc.client_secret,
        refresh_token: adc.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const body = await res.json();
    if (!body.access_token) {
      throw new Error(`ADC refresh failed (${res.status}) — re-run gcloud auth application-default login`);
    }
    return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  }

  const res = await fetch(
    `http://${METADATA_HOST}/computeMetadata/v1/instance/service-accounts/default/token`,
    { headers: { 'Metadata-Flavor': 'Google' } }
  );
  if (!res.ok) {
    throw new Error('No credentials: run gcloud auth application-default login (see app/gcp-setup.md step 7)');
  }
  const body = await res.json();
  return { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

// Cache the in-flight promise, not just the result — an analysis run fires its
// classification chunks through Promise.all, and each would otherwise mint its
// own token on a cold start.
function accessToken() {
  if (tokenCache && tokenCache.expiresAt - 60000 > Date.now()) return tokenCache.promise;
  // Expiry is provisional until the mint resolves; assume the shortest sane
  // lifetime so a slow mint can't hand out a token this cache thinks is fresh.
  const entry = { expiresAt: Date.now() + 60000 };
  entry.promise = mintToken().then((minted) => {
    entry.expiresAt = minted.expiresAt;
    return minted.token;
  }).catch((err) => {
    // Only evict if this entry is still the current one — a failure must not
    // discard a good token that a later call already installed.
    if (tokenCache === entry) tokenCache = null;
    throw err;
  });
  tokenCache = entry;
  return entry.promise;
}

// ---------- request shaping ----------

// The rest of the app speaks OpenAI-shaped messages. Gemini splits the system
// prompt out of the turn list and calls the assistant "model".
function toGeminiRequest(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const req = { contents };
  if (system) req.systemInstruction = { parts: [{ text: system }] };
  return req;
}

// Provider error bodies routinely echo the request back, and the chat message
// reaches the browser verbatim over SSE. Detail goes to the server log; the
// caller gets a sentence naming the surface the student is actually looking at.
function providerError(status, body, surface) {
  console.error(`[llm] ${surface} failed — Vertex ${status}: ${String(body).slice(0, 1000)}`);
  const busy = status === 429 || status === 503;
  if (surface === 'chat') {
    return new Error(busy
      ? 'The coach is busy right now. Wait a moment and try again.'
      : 'The coach is unavailable right now. Your work is saved.');
  }
  return new Error(busy
    ? 'The analysis is queued behind other work. Your draft is submitted — try again in a moment.'
    : 'The analysis could not be completed. Your draft is submitted.');
}

// Overridable from config.json (gcp.models.chat / gcp.models.analysis) so
// comparing models is a config edit, not a code change.
function modelFor(kind) {
  const models = config().gcp?.models || {};
  if (kind === 'chat') return models.chat || DEFAULT_CHAT_MODEL;
  return models.analysis || DEFAULT_ANALYSIS_MODEL;
}

// Returns the target too — llmCalls records whose Google bill the call landed
// on, which is not derivable from the URL after the fact.
async function vertexEndpoint({ model, method, schoolId }) {
  const target = await vertexTarget(schoolId);
  const { projectId, location } = target;
  const host = location === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`;
  return {
    url: `${host}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:${method}`,
    target,
  };
}

// ---------- cost accounting ----------

// One row per call. Tokens, never dollars: Gemini's prices have moved 2.5–4×
// in the life of this project, so storing dollars would make history
// incomparable and "what would last semester have cost at today's prices?"
// unanswerable. A versioned price table turns this log into a model; it lands
// with the platform-admin cost view, which reads these rows.
//
// Awaited rather than fire-and-forget: on Cloud Run a detached write can be
// killed when the instance scales down, and this row is the thing that cannot
// be reconstructed afterwards. It runs after the student has already seen the
// full reply, so it costs no perceived latency.
async function recordCall({ purpose, model, usage, latencyMs, target, meta, ok = true, errorCode = null }) {
  try {
    await col('llmCalls').add({
      ts: new Date().toISOString(),
      // Rows written before failures were recorded carry no `ok`, so absent
      // means success — the same convention `status` uses on users. Without a
      // failure row there is no denominator anywhere for "is Vertex healthy",
      // and an outage is only visible as an absence of successes, which looks
      // identical to a quiet afternoon.
      ok,
      errorCode,
      schoolId: meta?.schoolId || null,
      studentId: meta?.studentId || null,
      assignmentId: meta?.assignmentId || null,
      submissionId: meta?.submissionId || null,
      purpose,
      model,
      billsTo: target?.billsTo || 'platform',
      inputTokens: usage?.promptTokenCount || 0,
      cachedInputTokens: usage?.cachedContentTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
      thinkingTokens: usage?.thoughtsTokenCount || 0,
      latencyMs,
    });
  } catch (err) {
    // Never fail a student's reply because accounting failed.
    console.error('[llm] could not record llmCalls row:', err.message);
  }
}

// ---------- public seam ----------

// Streams completion tokens. Calls onToken(text) per chunk; resolves with the
// full text. Aborts cleanly when signal fires — partial text still returned so
// stopped generations persist with what the student actually saw.
async function streamChat({ messages, maxTokens = MAX_CHAT_TOKENS, signal, onToken, schoolId = null, meta = null }) {
  const model = modelFor('chat');
  const { url, target } = await vertexEndpoint({ model, method: 'streamGenerateContent?alt=sse', schoolId });
  const startedAt = Date.now();

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...toGeminiRequest(messages),
        generationConfig: {
          maxOutputTokens: maxTokens + CHAT_THINKING_BUDGET,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: CHAT_THINKING_BUDGET },
        },
      }),
    });
  } catch (err) {
    // Stopped before the first byte arrived. No text to keep, but this is a
    // student pressing Stop, not a failure — the caller must not show an error.
    if (err.name === 'AbortError') return '';
    throw err;
  }

  if (!res.ok) {
    const err = providerError(res.status, await res.text(), 'chat');
    await recordCall({ purpose: meta?.purpose || 'chat', model, latencyMs: Date.now() - startedAt, target, meta, ok: false, errorCode: res.status });
    throw err;
  }

  let full = '';
  let buffer = '';
  let usage = null;
  const decoder = new TextDecoder();

  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          // Several chunks carry usageMetadata; the last one holds the totals.
          if (payload.usageMetadata) usage = payload.usageMetadata;
          const parts = payload.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            // Thought parts carry the model's reasoning, not its reply. The
            // budget is 0 on chat so none should arrive — but a default change
            // upstream must not leak reasoning into a student's transcript.
            if (part.thought || !part.text) continue;
            full += part.text;
            onToken(part.text);
          }
        } catch {
          // partial JSON split across chunks — rejoin via buffer next iteration
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }

  // Recorded even when the student pressed Stop — the tokens were spent and
  // billed regardless of whether they read the whole reply.
  await recordCall({
    purpose: meta?.purpose || 'chat',
    model,
    usage,
    latencyMs: Date.now() - startedAt,
    target,
    meta,
  });

  return full;
}

// Non-streaming completion for analysis calls. Every current caller asks for
// JSON, so json:true makes the model emit it structurally rather than us
// trusting a "Return ONLY valid JSON" instruction to survive a model change.
async function complete({ messages, maxTokens = 1000, temperature = 0.2, json = false, schoolId = null, meta = null }) {
  const model = modelFor('analysis');
  const { url, target } = await vertexEndpoint({ model, method: 'generateContent', schoolId });
  const startedAt = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...toGeminiRequest(messages),
      generationConfig: {
        // Thinking is drawn from maxOutputTokens, so a caller's budget would
        // silently become an answer-length cut if the budget were ever raised.
        // Callers size maxTokens for the answer; the thinking allowance is ours.
        maxOutputTokens: maxTokens + ANALYSIS_THINKING_BUDGET,
        temperature,
        thinkingConfig: { thinkingBudget: ANALYSIS_THINKING_BUDGET },
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!res.ok) {
    const err = providerError(res.status, await res.text(), 'analysis');
    await recordCall({ purpose: meta?.purpose || 'analysis', model, latencyMs: Date.now() - startedAt, target, meta, ok: false, errorCode: res.status });
    throw err;
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join('');

  await recordCall({
    purpose: meta?.purpose || 'analysis',
    model,
    usage: data.usageMetadata,
    latencyMs: Date.now() - startedAt,
    target,
    meta,
  });

  if (!text) {
    console.error(`[llm] complete returned no text — finishReason=${candidate?.finishReason}, usage=${JSON.stringify(data.usageMetadata)}`);
    throw new Error('The analysis could not be completed.');
  }
  // Truncated JSON fails at the caller's parse with a message that points at
  // the prompt rather than the budget. Name the real cause here.
  if (candidate?.finishReason === 'MAX_TOKENS') {
    console.error(`[llm] complete hit maxOutputTokens (${maxTokens}) — output truncated, usage=${JSON.stringify(data.usageMetadata)}`);
  }
  return text.trim();
}

// modelFor is exported so the platform-admin Status view can show which models
// are actually in effect. Reading it from here rather than re-deriving it from
// config means the console can never disagree with what the calls use.
module.exports = { streamChat, complete, modelFor, MAX_EVAL_TOKENS };
