/**
 * Small, dependency-free helpers shared by the renderer, DOCX exporter,
 * ATS engine, and UI.
 */

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeText(value = '') {
  return String(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKey(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMarkdown(value = '') {
  return String(value).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
}

/**
 * Parse **bold** and *italic* markers into plain segments.
 * The resume data uses **bold** only; italics are structural.
 */
export function parseInlineMarkdown(value = '') {
  const text = String(value);
  const out = [];
  const re = /(\*\*\*|\*\*|\*)([\s\S]*?)\1/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      out.push({ text: text.slice(last, match.index), bold: false, italic: false });
    }
    const marker = match[1];
    out.push({
      text: match[2],
      bold: marker === '**' || marker === '***',
      italic: marker === '*' || marker === '***',
    });
    last = re.lastIndex;
  }
  if (last < text.length) {
    out.push({ text: text.slice(last), bold: false, italic: false });
  }
  if (!out.length) out.push({ text, bold: false, italic: false });
  return out;
}

export function markdownToHtml(value = '') {
  return parseInlineMarkdown(value)
    .map((seg) => {
      let html = escapeHtml(seg.text);
      if (seg.bold) html = `<strong>${html}</strong>`;
      if (seg.italic) html = `<em>${html}</em>`;
      return html;
    })
    .join('');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function joinNatural(items = []) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
}

export function truncateAtWord(value = '', maxChars = 200, suffix = '…') {
  const text = String(value).trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars - suffix.length);
  const cut = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf(','), slice.lastIndexOf(';'));
  return `${slice.slice(0, cut > maxChars * 0.6 ? cut : slice.length).trim()}${suffix}`;
}

export function splitSentences(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function sanitizeFilename(value = 'resume') {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120)
    .replace(/_+$/, '') || 'resume';
}

/**
 * Keep an exported filename short and predictable. A job title can contain a
 * team, req ID, or location suffix; only the first clean segment belongs in a
 * filename. The resume itself keeps the full title.
 */
export function compactTitle(value = '', { maxWords = 6, maxChars = 48 } = {}) {
  const primary = String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s*[|•·]\s*|\s+\/\s+|,\s|\s[-–—]\s/)[0]
    .replace(/\b(?:job\s*id|req(?:uisition)?|reference|posting)\b\s*[:#-]?\s*[\w-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let compact = primary.split(' ').filter(Boolean).slice(0, maxWords).join(' ');
  if (compact.length > maxChars) {
    compact = compact.slice(0, maxChars);
    const lastSpace = compact.lastIndexOf(' ');
    if (lastSpace > maxChars * 0.5) compact = compact.slice(0, lastSpace);
  }
  return compact
    .replace(/[\s,;:.-]+$/, '')
    .replace(/\s+(?:and|or|for|with|of|the|a|an)$/i, '')
    .trim();
}

/**
 * Drop junior-level wording from a job title before it is reused on the
 * resume: "Junior Data Scientist", "Jr. Data Scientist", "Entry-Level Data
 * Scientist", "Associate Data Scientist", and "Data Scientist I" all become
 * "Data Scientist". Senior and level II+ titles are kept.
 */
export function withoutJuniorLevel(title = '') {
  const stripped = String(title || '')
    .replace(/\b(?:junior|jr\.?|entry[- ]level|graduate|new[- ]grad|associate|intern(?:ship)?|trainee|apprentice)(?=\s|$)\s*/gi, '')
    .replace(/[\s,-]+(?:I|1|level\s*(?:I|1))$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /\w{3}/.test(stripped) ? stripped : String(title || '').trim();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text, filename, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function debounce(fn, wait = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
