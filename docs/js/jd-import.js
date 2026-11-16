/**
 * Read a job description from a pasted URL.
 *
 * Job boards rarely allow direct cross-origin reads. We use Jina Reader
 * first because it returns clean text and supports CORS. If it is blocked,
 * fall back to a public read-only proxy and finally to a direct fetch.
 * The extracted text is what gets saved; the URL never replaces the JD.
 */

const JINA_READER = 'https://r.jina.ai/';
const ALL_ORIGINS = 'https://api.allorigins.win/raw?url=';

function normalizeUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return '';
  }
  if (!/^https?:$/i.test(url.protocol)) return '';
  if (!url.hostname || !url.hostname.includes('.')) return '';
  return url.toString();
}

export function isUrlOnly(value = '') {
  const text = String(value || '').trim();
  if (!text || /\s/.test(text)) return false;
  return Boolean(normalizeUrl(text));
}

function cleanReaderText(value = '') {
  let text = String(value || '').replace(/\r\n?/g, '\n');
  // Jina Reader prefixes the markdown with a small metadata block.
  text = text.replace(/^Title:\s*[^\n]*\n+/i, '');
  text = text.replace(/^URL Source:\s*[^\n]*\n+/i, '');
  text = text.replace(/^Published Time:\s*[^\n]*\n+/i, '');
  text = text.replace(/^Markdown Content:\s*\n*/i, '');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  text = text.replace(/__([^_\n]+)__/g, '$1');
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function htmlToText(html = '') {
  let doc;
  try {
    doc = new DOMParser().parseFromString(String(html), 'text/html');
  } catch {
    return '';
  }
  for (const node of doc.querySelectorAll('script,style,noscript,svg,iframe,nav,header,footer,form')) {
    node.remove();
  }
  const root = doc.querySelector('article, main, [role="main"]') || doc.body;
  if (!root) return '';

  const blockTags = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
    'FIELDSET', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HR', 'LI', 'MAIN', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH',
    'TR', 'UL',
  ]);
  const lines = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      lines.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'BR') {
      lines.push('\n');
      return;
    }
    const block = blockTags.has(tag);
    if (block) lines.push('\n');
    if (tag === 'LI') lines.push('• ');
    for (const child of node.childNodes) walk(child);
    if (block) lines.push('\n');
  };
  walk(root);
  return lines.join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function looksLikeJobText(text = '') {
  const value = String(text || '').trim();
  if (value.length < 200) return false;
  if (!/[a-z]{3}/i.test(value)) return false;
  // A login wall or cookie notice is not a job description.
  if (/enable javascript|sign in to continue|cookie settings/i.test(value) && value.length < 600) {
    return false;
  }
  return true;
}

async function fetchText(url, { signal, timeout = 35000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8' },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.text();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * @param {string} value A URL, with or without a scheme.
 * @param {{signal?: AbortSignal}} options
 * @returns {Promise<{text: string, source: string, url: string}>}
 */
export async function fetchJobDescription(value, options = {}) {
  const url = normalizeUrl(value);
  if (!url) {
    throw new Error('Enter a valid http(s) job posting URL.');
  }

  const attempts = [
    {
      label: 'Jina Reader',
      read: async () => cleanReaderText(await fetchText(`${JINA_READER}${url}`, options)),
    },
    {
      label: 'public reader',
      read: async () => htmlToText(await fetchText(`${ALL_ORIGINS}${encodeURIComponent(url)}`, options)),
    },
    {
      label: 'the job site',
      read: async () => htmlToText(await fetchText(url, options)),
    },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const text = await attempt.read();
      if (looksLikeJobText(text)) {
        return { text, source: attempt.label, url };
      }
      lastError = new Error('The page did not return readable job text.');
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  const detail = lastError?.status === 403 || lastError?.status === 401
    ? 'The job site blocked automated reading.'
    : 'The job site did not return readable text.';
  throw new Error(`${detail} Open the posting, copy the description, and paste it here.`);
}

export { normalizeUrl };
