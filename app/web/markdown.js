// Presentation-only markdown for AI turns.
//
// The chat is unsteered by design (server/coach.js) — no system prompt, so the
// model answers in its house style, which is markdown. Nothing asks it to, and
// nothing should: the artifact being measured is an ordinary chat. So the
// asterisks and hashes are ours to render, not the model's to stop emitting.
//
// Escape first, transform second. Model output is untrusted text and the
// escaped string is the only thing this file ever builds HTML from.
//
// Student turns never come through here. A student's message is the evidence
// the whole product reads, and it displays exactly as typed.

const MD_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const mdEsc = (s) => String(s).replace(/[&<>"]/g, (c) => MD_ESCAPE[c]);

// Inline pass, run over already-escaped text. Code spans are extracted first
// and put back last, so `**` inside backticks stays literal.
function mdInline(escaped) {
  const spans = [];
  let out = escaped.replace(/`([^`\n]+)`/g, (_, code) => {
    spans.push(code);
    return `\u0000${spans.length - 1}\u0000`;
  });

  out = out
    .replace(/\*\*\*([^\s*][^*]*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^\s*][^*]*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^\s*][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^\s_][^_]*?)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${spans[+i]}</code>`);
}

// Block pass. Deliberately a small subset — a chat bubble is not a document,
// so headings render as a bold lead-in rather than real <h1>–<h6>, which would
// put document-level type into a 15.5px bubble and into the report's replay.
function renderMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let list = null;          // 'ul' | 'ol' | null
  let para = [];
  let fence = null;         // accumulating code-block lines, or null

  const flushPara = () => {
    if (!para.length) return;
    html.push(`<p>${mdInline(mdEsc(para.join('\n')))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) { html.push(`</${list}>`); list = null; }
  };
  const openList = (kind) => {
    if (list === kind) return;
    closeList();
    html.push(`<${kind}>`);
    list = kind;
  };

  for (const line of lines) {
    if (fence !== null) {
      if (/^\s*```/.test(line)) {
        html.push(`<pre><code>${mdEsc(fence.join('\n'))}</code></pre>`);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (/^\s*```/.test(line)) { flushPara(); closeList(); fence = []; continue; }

    if (!line.trim()) { flushPara(); closeList(); continue; }

    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      flushPara(); closeList();
      html.push(`<p class="md-head">${mdInline(mdEsc(heading[1]))}</p>`);
      continue;
    }

    if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) {
      flushPara(); closeList();
      html.push('<hr>');
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushPara(); openList('ul');
      html.push(`<li>${mdInline(mdEsc(bullet[1]))}</li>`);
      continue;
    }

    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara(); openList('ol');
      html.push(`<li>${mdInline(mdEsc(numbered[1]))}</li>`);
      continue;
    }

    if (list) closeList();
    para.push(line);
  }

  // An unterminated fence is the normal state mid-stream, not an error — show
  // what has arrived rather than holding the whole block back until it closes.
  if (fence !== null && fence.length) html.push(`<pre><code>${mdEsc(fence.join('\n'))}</code></pre>`);
  flushPara();
  closeList();

  return html.join('');
}

// The one entry point every surface uses, so chat, report and the teacher's
// transcript can never drift into rendering the same bubble differently.
function setMarkdown(node, text) {
  node.classList.add('msg-prose');
  node.innerHTML = renderMarkdown(text);
  return node;
}

if (typeof module !== 'undefined') module.exports = { renderMarkdown, setMarkdown };
