// LLM seam. Dev: Groq (key from root config.json or GROQ_API_KEY).
// Prod: swap for Vertex Gemini behind the same two functions.
// maxOutputTokens capped per the cost guardrails in built-in-chat-plan.md.

const fs = require('fs');
const path = require('path');

const CHAT_MODEL = 'llama-3.3-70b-versatile';
const MAX_CHAT_TOKENS = 500;
const MAX_EVAL_TOKENS = 400;

function apiKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const configPath = path.join(__dirname, '..', '..', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.groq?.apiKey) return config.groq.apiKey;
  }
  throw new Error('No Groq key: set GROQ_API_KEY or add groq.apiKey to config.json');
}

// Streams completion tokens. Calls onToken(text) per chunk; resolves with the
// full text. Aborts cleanly when signal fires — partial text still returned so
// stopped generations persist with what the student actually saw.
async function streamChat({ messages, maxTokens = MAX_CHAT_TOKENS, signal, onToken }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }

  let full = '';
  let buffer = '';
  const decoder = new TextDecoder();

  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;
        try {
          const token = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (token) {
            full += token;
            onToken(token);
          }
        } catch {
          // partial JSON split across chunks — rejoin via buffer next iteration
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }

  return full;
}

// Non-streaming completion for analysis calls. Retries on 429 — Groq's
// free-tier TPM limit trips easily when a chat session and its analysis
// land in the same minute. (Vertex won't need this at pilot scale.)
async function complete({ messages, maxTokens = 1000, temperature = 0.2 }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (res.ok) return (await res.json()).choices[0].message.content.trim();

    const body = await res.text();
    if (res.status === 429 && attempt < 4) {
      const waitMatch = body.match(/try again in ([\d.]+)s/);
      const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : 2 ** attempt * 5000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 60000)));
      continue;
    }
    throw new Error(`Groq ${res.status}: ${body.slice(0, 300)}`);
  }
}

module.exports = { streamChat, complete, MAX_EVAL_TOKENS };
