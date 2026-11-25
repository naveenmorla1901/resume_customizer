import puppeteer from '@cloudflare/puppeteer';
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://naveenmorla1901.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765',
];
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_TOKENS = 4000;
const ALLOWED_MODELS = new Set(['deepseek-flash', 'deepseek-v4-pro']);

const PDF_ROUTE = '/tailor.pdf';
const MASTER_ROUTE = '/master';
const HEALTH_ROUTE = '/health';
const MCP_ROUTE = '/mcp';
const HISTORY_ROUTE = '/history';
const FETCH_JD_ROUTE = '/fetch-jd';
const FILE_ROUTE_PREFIX = '/files/';
const FILE_TTL_SECONDS = 60 * 60;
const HISTORY_PREFIX = 'history:';
const HISTORY_TTL_SECONDS = 90 * 24 * 60 * 60;
const HISTORY_LIMIT = 100;
const APP_URL = 'https://naveenmorla1901.github.io/resume_customizer/';
const PROXY_URL = 'https://resume-deepseek-proxy.morla-naveen1901.workers.dev';
const DEEPSEEK_TOOLS_BASE = 'https://api.deepseek.com';
const MAX_PDF_BODY_BYTES = 128 * 1024;
const MAX_MASTER_BODY_BYTES = 128 * 1024;
const MAX_JD_CHARS = 20_000;
const MIN_JD_CHARS = 20;
const MIN_FETCHED_JD_CHARS = 400;
const MAX_FETCH_URL_CHARS = 8192;
const PDF_TIMEOUT_MS = 60_000;
const TAILOR_TIMEOUT_MS = 90_000;
const FETCH_TIMEOUT_MS = 25_000;

function allowedOrigins(env) {
  const configured = String(env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function historyCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function historyJson(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (origin) Object.assign(headers, historyCorsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function fetchJdCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function fetchJdJson(body, status = 200, origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (origin) Object.assign(headers, fetchJdCorsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

function errorResponse(message, status, origin) {
  return jsonResponse({ error: { message } }, status, origin);
}

function apiJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function apiError(message, status = 400) {
  return apiJson({ error: { message } }, status);
}

/**
 * Browser calls from an allowed origin use the same trust as the DeepSeek
 * proxy route, so the studio and History page work without a token. Calls
 * without an Origin header (scripts, curl, MCP clients) still need the
 * bearer token.
 */
function authorizedForBrowserRoute(request, env, origin, allowed) {
  if (origin && allowed.includes(origin)) return { ok: true };
  return authorized(request, env);
}

function authorized(request, env) {
  const expected = String(env?.PDF_API_TOKEN || '');
  if (!expected) {
    return { ok: false, status: 500, message: 'PDF_API_TOKEN is not configured on the Worker.' };
  }
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return { ok: false, status: 401, message: 'Missing bearer token.' };
  }
  const provided = match[1].trim();
  if (provided.length !== expected.length) {
    return { ok: false, status: 401, message: 'Invalid bearer token.' };
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (diff !== 0) {
    return { ok: false, status: 401, message: 'Invalid bearer token.' };
  }
  return { ok: true };
}

async function readJsonBody(request, maxBytes) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { status: 413, error: 'Request body is too large.' };
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { status: 413, error: 'Request body is too large.' };
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { status: 400, error: 'Invalid JSON body.' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 400, error: 'JSON body must be an object.' };
  }
  return { body };
}

function normalizeHttpUrl(value) {
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
  if (url.username || url.password) return '';
  return url.toString();
}

function cleanFetchedText(value) {
  let text = String(value || '').replace(/\r\n?/g, '\n');
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, '');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  text = text.replace(/__([^_\n]+)__/g, '$1');
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

const BLOCKED_PAGE_PATTERNS = [
  /\bclearrelay\b/i,
  /open this device as an? (?:recorder|admin|projector)/i,
  /enter the access key/i,
  /performing security verification/i,
  /checking (?:your browser|if the site connection is secure)/i,
  /verif(?:y|ying) (?:that )?you are (?:a )?human/i,
  /enable javascript and cookies to continue/i,
  /^\s*(?:access denied|request blocked|attention required)\b/i,
];

const JOB_BOARD_HOST_RE = /(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|jobvite\.com|icims\.com|workable\.com|recruitee\.com)$/i;
const COMPANY_STOPWORDS = new Set(['the', 'and', 'inc', 'llc', 'corp', 'corporation', 'company', 'ltd', 'limited', 'group', 'holdings']);
const TITLE_STOPWORDS = new Set([
  'job', 'jobs', 'role', 'position', 'opportunity', 'career', 'careers',
  'the', 'and', 'for', 'with', 'at', 'in', 'of', 'to', 'a', 'an', 'on', 'or',
  'senior', 'sr', 'staff', 'lead', 'principal', 'ii', 'iii', 'iv',
]);

function looksLikeBlockedPage(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/\bprivate access\b/i.test(text) && /\b(?:access key|recorder|projector|this device)\b/i.test(text)) {
    return true;
  }
  if (BLOCKED_PAGE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return text.length < 1200 && /^(?:just a moment|access denied|forbidden|unauthorized)\b/i.test(text);
}

function looksLikeJobText(value = '') {
  const text = String(value || '').trim();
  if (text.length < MIN_JD_CHARS) return false;
  if (!/[a-z]{3}/i.test(text)) return false;
  return !looksLikeBlockedPage(text);
}

function hostBase(value = '') {
  try {
    return new URL(String(value)).hostname
      .replace(/^www\./, '')
      .replace(/^(?:jobs|careers|job-boards|boards|apply)\./, '')
      .toLowerCase();
  } catch {
    return '';
  }
}

function deriveCompanyFromUrl(value = '') {
  try {
    const url = new URL(String(value));
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (JOB_BOARD_HOST_RE.test(host)) {
      const part = url.pathname.split('/').filter(Boolean).find((segment) => (
        !/^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)
        && !/^(?:jobs?|careers?|positions?|apply|details?|en|us)$/i.test(segment)
        && !/^\d+$/.test(segment)
      ));
      if (part) return part.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const base = host.replace(/^(?:jobs|careers|job-boards|boards|apply)\./, '').split('.')[0];
    return base && base.length >= 3 ? base : '';
  } catch {
    return '';
  }
}

function deriveTitleFromUrl(value = '') {
  try {
    const url = new URL(String(value));
    const segments = url.pathname.split('/').map((segment) => decodeURIComponent(segment)).filter(Boolean);
    let candidate = segments[segments.length - 1] || '';
    if (/^\d{5,}$/.test(candidate)) candidate = segments[segments.length - 2] || '';
    if (!candidate || /^[a-z]{2}(?:-[a-z]{2})?$/i.test(candidate)) return '';
    if (/^[0-9a-f]{8,}(?:-[0-9a-f]{4,}){1,}$/i.test(candidate)) return '';
    const words = candidate
      .replace(/[._]+/g, ' ')
      .replace(/[-_]+/g, ' ')
      .replace(/\bslash\b/gi, ' ')
      .replace(/^\d+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((word) => word.length >= 2 && /[a-z]/i.test(word));
    return words.length >= 2 ? words.join(' ').slice(0, 120) : '';
  } catch {
    return '';
  }
}

function companyKeyFrom(value = '') {
  const words = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= 2 && !COMPANY_STOPWORDS.has(word));
  return words[0] || '';
}

function titleTokens(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token) && !TITLE_STOPWORDS.has(token));
}

function candidateRelevant(candidate, { originalHost, companyKey, titleSet, originalId }) {
  const candidateHost = hostBase(candidate.url);
  if (!candidateHost) return false;
  const sameHost = candidateHost === originalHost;
  const blob = `${candidate.title || ''} ${candidate.url} ${String(candidate.content || '').slice(0, 3000)}`.toLowerCase();
  const companyMatch = companyKey.length >= 3 && blob.includes(companyKey);
  const candidateTokens = new Set(titleTokens(candidate.title || ''));
  const overlap = [...titleSet].filter((token) => candidateTokens.has(token));
  // Require most of the role words, not just "AI" and "Engineer". This keeps
  // a parent-company or same-family posting from replacing the requested job.
  const titleMatch = titleSet.size > 0
    && overlap.length >= Math.min(titleSet.size, 3)
    && overlap.length >= 2;
  const idMatch = Boolean(originalId) && `${candidate.url} ${candidate.title || ''}`.includes(originalId);
  if (sameHost) return titleMatch || idMatch;
  return Boolean(companyMatch && titleMatch);
}

async function deepSeekTool(env, path, payload) {
  if (!env.DEEPSEEK_API_KEY) {
    const error = new Error('DEEPSEEK_API_KEY is not configured on the Worker.');
    error.status = 500;
    throw error;
  }
  const base = String(env.DEEPSEEK_BASE_URL || DEEPSEEK_TOOLS_BASE).replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
    if (!response.ok) {
      const message = data?.error?.message
        ? `DeepSeek ${path} failed: ${data.error.message}`
        : `DeepSeek ${path} returned HTTP ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data || {};
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeout = new Error('DeepSeek timed out while reading the web page.');
      timeout.status = 504;
      throw timeout;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJobDescriptionFromUrl(env, { url, company = '', jobTitle = '' }) {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) {
    const error = new Error('Enter a valid http(s) job posting URL.');
    error.status = 400;
    throw error;
  }

  let fetched = null;
  let fetchError = null;
  let blockedPage = false;
  try {
    const page = await deepSeekTool(env, '/v1/tools/fetch', { url: normalized });
    const text = cleanFetchedText(page?.content);
    const title = String(page?.title || '').trim();
    if (looksLikeBlockedPage(text)) {
      // Bot challenges and device/access gates are not job descriptions.
      blockedPage = true;
      fetched = { text: '', title, url: normalized };
      fetchError = new Error('The job site returned a bot or access gate instead of the posting.');
      fetchError.status = 422;
    } else {
      fetched = { text, title, url: normalized };
      if (text.length >= MIN_FETCHED_JD_CHARS) {
        return {
          text: text.slice(0, MAX_JD_CHARS),
          title,
          url: normalized,
          source: 'fetch',
        };
      }
    }
  } catch (error) {
    fetchError = error;
  }

  const companyHint = String(company || '').replace(/\s+/g, ' ').trim()
    || deriveCompanyFromUrl(normalized);
  const titleHint = String(jobTitle || '').replace(/\s+/g, ' ').trim()
    || deriveTitleFromUrl(normalized)
    || (!blockedPage && fetched?.title)
    || '';
  const terms = [companyHint, titleHint, !blockedPage && fetched?.title]
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  let query = [...new Set(terms)].join(' ').slice(0, 128).trim();
  if (query.length < 3) {
    try {
      const parsed = new URL(normalized);
      const slug = decodeURIComponent(parsed.pathname)
        .replace(/[\/_?=&.-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      query = `${parsed.hostname.replace(/^www\./, '')} ${slug}`.slice(0, 128).trim();
    } catch {
      query = '';
    }
  }

  if (!blockedPage && query.length >= 3) {
    try {
      const search = await deepSeekTool(env, '/v1/tools/search', {
        query,
        count: 5,
        need_content: true,
      });
      const originalHost = hostBase(normalized);
      const originalId = (() => {
        try {
          return (new URL(normalized).pathname.match(/\d{6,}/) || [''])[0];
        } catch {
          return '';
        }
      })();
      const companyKey = companyKeyFrom(companyHint);
      const titleSet = new Set(titleTokens(titleHint));
      const candidates = (Array.isArray(search?.results) ? search.results : [])
        .filter((result) => result && result.url)
        .map((result) => {
          const host = hostBase(result.url);
          const title = String(result.title || '').toLowerCase();
          const titleHit = [companyHint, titleHint].some((term) => term && title.includes(String(term).toLowerCase()));
          const rank = (Number(result.rerank_score) || 0)
            + (host && host === originalHost ? 2 : 0)
            + (titleHit ? 1 : 0);
          return { ...result, rank };
        })
        .filter((candidate) => {
          // Only accept the same posting or a result that names both the
          // company and the role. A generic "ML Engineer" hit is not enough.
          const candidateUrl = normalizeHttpUrl(candidate.url);
          if (candidateUrl && candidateUrl === normalized) return true;
          return candidateRelevant(candidate, { originalHost, companyKey, titleSet, originalId });
        })
        .sort((a, b) => b.rank - a.rank);

      const summaries = [];
      for (const candidate of candidates) {
        const content = cleanFetchedText(candidate.content);
        if (content.length >= MIN_FETCHED_JD_CHARS && looksLikeJobText(content)) {
          return {
            text: content.slice(0, MAX_JD_CHARS),
            title: String(candidate.title || fetched?.title || titleHint || '').trim(),
            url: normalizeHttpUrl(candidate.url) || normalized,
            source: 'search-content',
          };
        }
        if (candidate.summary) {
          const summary = cleanFetchedText(candidate.summary);
          if (summary.length >= MIN_JD_CHARS && looksLikeJobText(summary)) summaries.push(summary);
        }
      }

      for (const candidate of candidates.slice(0, 2)) {
        const candidateUrl = normalizeHttpUrl(candidate.url);
        if (!candidateUrl) continue;
        try {
          const page = await deepSeekTool(env, '/v1/tools/fetch', { url: candidateUrl });
          const text = cleanFetchedText(page?.content);
          if (text.length >= MIN_FETCHED_JD_CHARS && looksLikeJobText(text)) {
            return {
              text: text.slice(0, MAX_JD_CHARS),
              title: String(page?.title || candidate.title || titleHint || '').trim(),
              url: candidateUrl,
              source: 'search+fetch',
            };
          }
        } catch {
          // Try the next search result.
        }
      }

      const combined = summaries.join('\n\n').slice(0, MAX_JD_CHARS).trim();
      if (combined.length >= MIN_FETCHED_JD_CHARS) {
        return {
          text: combined,
          title: String(candidates[0]?.title || fetched?.title || titleHint || '').trim(),
          url: normalized,
          source: 'search-summary',
        };
      }
    } catch {
      // Search is a fallback; report the original fetch problem below.
    }
  }

  if (fetched?.text && fetched.text.length >= MIN_JD_CHARS && looksLikeJobText(fetched.text)) {
    return {
      text: fetched.text.slice(0, MAX_JD_CHARS),
      title: fetched.title,
      url: normalized,
      source: 'fetch-short',
    };
  }

  const unreadable = fetchError
    && [401, 403, 404, 451].includes(Number(fetchError.status));
  const error = new Error(
    blockedPage || unreadable
      ? 'The job site blocked automated reading or did not return the posting. Open it in your browser, copy the description, and paste it instead.'
      : fetchError?.message
        ? `Could not read the job posting: ${fetchError.message}`
        : 'The job posting did not contain enough readable text. Paste the job description instead.',
  );
  error.status = blockedPage || unreadable ? 422 : fetchError?.status || 422;
  throw error;
}

async function resolveJobDescription(env, { jobDescription, jobUrl, company, jobTitle }) {
  let jd = String(jobDescription || '').trim();
  const url = normalizeHttpUrl(jobUrl);
  let source = null;

  if (url && jd.length < MIN_FETCHED_JD_CHARS) {
    try {
      const fetched = await fetchJobDescriptionFromUrl(env, { url, company, jobTitle });
      if (fetched.text.length > jd.length) {
        jd = fetched.text;
        source = fetched;
      }
    } catch (error) {
      if (jd.length < MIN_JD_CHARS) throw error;
    }
  }

  if (jd.length < MIN_JD_CHARS) {
    const error = new Error(`Provide a jobDescription of at least ${MIN_JD_CHARS} characters, or a readable jobUrl.`);
    error.status = 400;
    throw error;
  }
  if (jd.length > MAX_JD_CHARS) jd = jd.slice(0, MAX_JD_CHARS);
  return { jd, source };
}

function truncate(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function recordHistory(env, record = {}) {
  if (!env.RESUME_MASTER) return;
  const at = new Date().toISOString();
  const key = `${HISTORY_PREFIX}${at}:${randomFileId().slice(0, 8)}`;
  const score = Number(record.score);
  const metadata = {
    at,
    status: record.status === 'error' ? 'error' : 'ok',
    source: record.source || 'api',
    mode: record.ai ? 'ai' : 'local',
    filename: truncate(record.filename, 100),
    company: truncate(record.company, 60),
    role: truncate(record.role, 60),
    score: Number.isFinite(score) ? score : null,
    delta: truncate(record.delta, 90),
    projects: (Array.isArray(record.projects) ? record.projects : []).slice(0, 4).map((p) => truncate(p, 40)),
    fileId: record.fileId || null,
    expiresAt: record.fileId ? new Date(Date.now() + FILE_TTL_SECONDS * 1000).toISOString() : null,
    error: record.error ? truncate(record.error, 120) : null,
    jobSource: record.jobSource ? truncate(record.jobSource, 120) : null,
  };
  try {
    await env.RESUME_MASTER.put(key, '1', {
      expirationTtl: HISTORY_TTL_SECONDS,
      metadata,
    });
  } catch {
    // History is best-effort and must never fail the resume request.
  }
}

function isMaster(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.profile
    && typeof value.profile === 'object'
    && Array.isArray(value.experience)
    && value.experience.length > 0,
  );
}

function sanitizeFilename(value, fallback) {
  const requested = String(value || '').trim();
  const base = requested
    .replace(/\.pdf$/i, '')
    .replace(/["\\\r\n\t]+/g, ' ')
    .replace(/[^a-z0-9._ -]+/gi, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/^[._ -]+|[._ -]+$/g, '')
    .slice(0, 120)
    .trim();
  return `${base || fallback}.pdf`;
}

const FILENAME_ABBREVIATIONS = [
  [/\bmachine[ _]learning\b/gi, 'ML'],
  [/\bartificial[ _]intelligence\b/gi, 'AI'],
  [/\bgenerative[ _]ai\b/gi, 'GenAI'],
  [/\bnatural[ _]language[ _]processing\b/gi, 'NLP'],
  [/\bbusiness[ _]intelligence\b/gi, 'BI'],
  [/\bsenior\b/gi, 'Sr'],
  [/\boperations\b/gi, 'Ops'],
  [/\bengineering\b/gi, 'Eng'],
];
const MAX_FILENAME_CHARS = 40;
const ROLE_WORD_RE = /^(?:engineer|scientist|analyst|developer|architect|manager|specialist|consultant|lead|researcher|director|programmer|administrator|technician)s?$/i;

/**
 * Keep upload filenames short: job titles often carry a level, a team, and a
 * req ID ("Machine Learning Software Engineer I, AI Applications (R12345)").
 * Drop bracketed text, anything after a comma, numbers, dates, and levels,
 * abbreviate common phrases, and cap the length at a word boundary.
 */
function shortenFilenameBase(value = '') {
  let text = String(value || '')
    .replace(/\.pdf$/i, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .split(/,|\s\|\s/)[0]
    .replace(/_+/g, ' ');
  for (const [pattern, short] of FILENAME_ABBREVIATIONS) text = text.replace(pattern, short);
  const words = text
    .replace(/[^a-z0-9 ]+/gi, ' ')
    .split(/\s+/)
    .filter((word) => word
      && !/\d/.test(word)
      && !/^(?:I{1,3}|IV|V|resume|cv|junior|jr|entry|level|associate|intern)$/i.test(word));
  // End right after the role word so a trailing team name ("AI
  // Applications") is dropped.
  const roleEnd = words.reduce((last, word, index) => (
    ROLE_WORD_RE.test(word) && words.slice(0, index + 1).join('_').length <= MAX_FILENAME_CHARS ? index : last
  ), -1);
  let out = (roleEnd >= 0 ? words.slice(0, roleEnd + 1) : words).join('_');
  while (out.length > MAX_FILENAME_CHARS && out.includes('_')) out = out.slice(0, out.lastIndexOf('_'));
  return out;
}

function pdfFilename(company, requested, jobTitle = '') {
  const label = shortenFilenameBase(jobTitle).split('_').slice(0, 3).join('_')
    || shortenFilenameBase(company).split('_').slice(0, 2).join('_');
  const fallback = `Naveen_Morla${label ? `_${label}` : '_Resume'}`;
  const short = shortenFilenameBase(requested);
  return sanitizeFilename(short || '', fallback);
}

async function loadStoredMaster(env) {
  if (!env.RESUME_MASTER) return null;
  try {
    const stored = await env.RESUME_MASTER.get('master', 'json');
    return isMaster(stored) ? stored : null;
  } catch {
    return null;
  }
}

function randomFileId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function storePdf(env, pdf, filename) {
  if (!env.RESUME_MASTER) return null;
  const id = randomFileId();
  const bytes = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  await env.RESUME_MASTER.put(`pdf:${id}`, bytes, {
    expirationTtl: FILE_TTL_SECONDS,
    metadata: { filename },
  });
  return id;
}

async function generatePdf(env, { master, jd, ai }) {
  if (!env.BROWSER) throw new Error('BROWSER binding is not configured.');

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    page.setDefaultTimeout(PDF_TIMEOUT_MS);

    await page.goto(`${APP_URL}?api=${Date.now()}`, {
      waitUntil: 'networkidle0',
      timeout: PDF_TIMEOUT_MS,
    });

    const settings = ai
      ? {
          connectionMode: 'proxy',
          proxyUrl: PROXY_URL,
          model: 'deepseek-flash',
          endpoint: DEEPSEEK_ENDPOINT,
          useAI: true,
          rewriteBullets: true,
        }
      : { useAI: false };

    await page.evaluate(({ masterData, settingsData }) => {
      localStorage.clear();
      localStorage.setItem('resumeStudio.v1.master', JSON.stringify(masterData));
      localStorage.setItem('resumeStudio.v1.onboarded', 'true');
      localStorage.setItem('resumeStudio.v1.settings', JSON.stringify(settingsData));
    }, { masterData: master, settingsData: settings });

    await page.reload({ waitUntil: 'networkidle0', timeout: PDF_TIMEOUT_MS });

    await page.evaluate(() => {
      const modal = document.getElementById('welcome-modal');
      if (modal) modal.hidden = true;
      // printPdf() calls this after populating #print-root; suppress the
      // browser print dialog so page.pdf() can capture the print layout.
      window.print = () => {};
    });

    await page.evaluate(({ jobDescription, useAI }) => {
      const input = document.getElementById('jd-input');
      if (!input) throw new Error('Job description input was not found.');
      input.value = jobDescription;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const toggle = document.getElementById('ai-toggle');
      if (toggle) toggle.checked = Boolean(useAI);
    }, { jobDescription: jd, useAI: ai });

    await page.click('#btn-tailor');
    await page.waitForFunction(() => {
      const loading = document.getElementById('loading-modal');
      const ats = document.getElementById('ats-card');
      const pages = document.querySelectorAll('#preview-mount .resume-page');
      return Boolean(ats && !ats.hidden && (!loading || loading.hidden) && pages.length === 2);
    }, { timeout: TAILOR_TIMEOUT_MS });

    // Let the fit/fill pass settle before capturing the final layout.
    await new Promise((resolve) => setTimeout(resolve, 750));

    const meta = await page.evaluate(() => {
      const text = (id) => document.getElementById(id)?.textContent?.trim() || '';
      const projects = [...document.querySelectorAll('#preview-mount .project-name')]
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      return {
        score: Number(text('score-value')) || 0,
        keywordScore: text('keyword-score'),
        titleScore: text('title-score'),
        formatScore: text('format-score'),
        delta: text('score-delta'),
        role: text('ats-heading'),
        projects: [...new Set(projects)].slice(0, 4),
      };
    });

    await page.click('#btn-print');
    await page.waitForFunction(
      () => document.querySelectorAll('#print-root .resume-page').length === 2,
      { timeout: 30_000 },
    );

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return { pdf, meta };
  } finally {
    await browser.close();
  }
}

async function handleMaster(request, env) {
  const auth = authorized(request, env);
  if (!auth.ok) return apiError(auth.message, auth.status);
  if (request.method !== 'PUT') return apiError('Method not allowed. Use PUT.', 405);
  if (!env.RESUME_MASTER) {
    return apiError('RESUME_MASTER KV binding is not configured.', 500);
  }

  const parsed = await readJsonBody(request, MAX_MASTER_BODY_BYTES);
  if (parsed.error) return apiError(parsed.error, parsed.status);
  if (!isMaster(parsed.body)) {
    return apiError('Body must be a resume master with a profile and at least one experience role.', 400);
  }

  await env.RESUME_MASTER.put('master', JSON.stringify(parsed.body));
  return apiJson({
    ok: true,
    projects: Array.isArray(parsed.body.projects) ? parsed.body.projects.length : 0,
  });
}

async function handleHealth(env) {
  let masterStored = false;
  if (env.RESUME_MASTER) {
    try {
      masterStored = Boolean(await env.RESUME_MASTER.get('master'));
    } catch {
      masterStored = false;
    }
  }
  return apiJson({
    ok: true,
    tokenConfigured: Boolean(env.PDF_API_TOKEN),
    kvConfigured: Boolean(env.RESUME_MASTER),
    browserConfigured: Boolean(env.BROWSER),
    masterStored,
    mcp: true,
    history: Boolean(env.RESUME_MASTER),
    fetchJd: Boolean(env.DEEPSEEK_API_KEY),
  });
}

function createResumeMcpServer(env, baseUrl) {
  const server = new McpServer({ name: 'resume-studio', version: '1.0.0' });

  server.registerTool('tailor_resume', {
    title: 'Tailor resume to a job description',
    description: [
      'Create a tailored two-page PDF resume from a job description or a job posting URL and return a temporary download link.',
      'Use this whenever the user provides a job description, a job posting URL, or asks for a resume tailored to a role.',
      'If the user only has a link, pass jobUrl; the Worker reads the page with DeepSeek Fetch and falls back to Search when the page is too thin.',
      'Pass the full job description when available; jobUrl is a fallback for thin or unavailable text.',
      'The resume is built from Naveen Morla\'s stored master resume and keeps the existing two-page layout, fonts, and clickable project links.',
      'Pass filename only when the user asks for a specific one; keep it short (for example "Naveen_Morla_ML_Engineer"), without levels, req IDs, team names, or dates. Long names are shortened automatically and the .pdf extension is added.',
      'DeepSeek tailoring is on by default; pass ai=false only when the user asks for fast, deterministic local tailoring.',
    ].join(' '),
    inputSchema: z.object({
      jobDescription: z.string().max(MAX_JD_CHARS).optional().describe('The complete job description text, not just the job title. Provide this or jobUrl.'),
      jobUrl: z.string().max(MAX_FETCH_URL_CHARS).optional().describe('Job posting URL. When the description is missing or short, the Worker reads it with DeepSeek Fetch and falls back to Search.'),
      jobTitle: z.string().max(120).optional().describe('Job title, used to improve the URL fallback search and the history entry.'),
      company: z.string().max(80).optional().describe('Company name used in the default filename and history.'),
      ai: z.boolean().optional().describe('true or omitted = DeepSeek tailoring (default); false = deterministic local tailoring.'),
      filename: z.string().max(140).optional().describe('Short output filename, for example "Naveen_Morla_ML_Engineer". Levels, req IDs, team names, and dates are removed and the name is capped at about 40 characters.'),
    }),
  }, async ({ jobDescription, jobUrl, jobTitle, company, ai, filename }) => {
    const safeCompany = String(company || '').trim().slice(0, 80);
    const safeTitle = String(jobTitle || '').trim().slice(0, 120);
    const name = pdfFilename(safeCompany, filename, safeTitle);
    const useAi = ai !== false && Boolean(env.DEEPSEEK_API_KEY);
    try {
      const master = await loadStoredMaster(env);
      if (!master) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'No master resume is stored. Upload it with PUT /master first.' }],
        };
      }
      if (ai === true && !env.DEEPSEEK_API_KEY) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'AI mode is not configured: DEEPSEEK_API_KEY is missing. Retry with ai=false.' }],
        };
      }

      const { jd, source } = await resolveJobDescription(env, {
        jobDescription,
        jobUrl,
        company: safeCompany,
        jobTitle: safeTitle,
      });
      const { pdf, meta } = await generatePdf(env, { master, jd, ai: useAi });
      const id = await storePdf(env, pdf, name);
      const url = id ? `${baseUrl}${FILE_ROUTE_PREFIX}${id}` : null;
      await recordHistory(env, {
        status: 'ok',
        source: 'mcp',
        ai: useAi,
        filename: name,
        company: safeCompany,
        role: meta.role || safeTitle,
        score: meta.score,
        delta: meta.delta,
        projects: meta.projects,
        fileId: id,
        jobSource: source?.url || '',
      });
      const mode = useAi ? 'DeepSeek AI rewrite' : 'deterministic local tailoring';
      const lines = [
        `Resume PDF generated with ${mode}.`,
        source ? `Job description read from ${source.url}.` : '',
        `Filename: ${name}`,
        url
          ? `Download (link expires in 60 minutes): ${url}`
          : 'Temporary file storage is unavailable. Use POST /tailor.pdf to download the PDF directly.',
        'The PDF keeps the two-page layout, clickable project links, and the "Private project" label for MS-FTAE.',
      ].filter(Boolean);
      const content = [{ type: 'text', text: lines.join('\n') }];
      if (url) {
        content.push({
          type: 'resource_link',
          uri: url,
          name,
          mimeType: 'application/pdf',
          description: 'Tailored resume PDF. Download before the link expires.',
        });
      }
      return { content };
    } catch (error) {
      await recordHistory(env, {
        status: 'error',
        source: 'mcp',
        ai: useAi,
        filename: name,
        company: safeCompany,
        role: safeTitle,
        error: error?.message || 'unknown error',
        jobSource: normalizeHttpUrl(jobUrl) || '',
      });
      return {
        isError: true,
        content: [{ type: 'text', text: `Resume generation failed: ${error?.message || 'unknown error'}` }],
      };
    }
  });

  server.registerTool('resume_service_status', {
    title: 'Check resume service status',
    description: 'Report whether the resume service has a stored master, PDF token, KV storage, Browser Rendering, and DeepSeek. Use only when a resume request fails or the user asks whether the service is ready.',
  }, async () => {
    const status = {
      tokenConfigured: Boolean(env.PDF_API_TOKEN),
      kvConfigured: Boolean(env.RESUME_MASTER),
      browserConfigured: Boolean(env.BROWSER),
      deepSeekConfigured: Boolean(env.DEEPSEEK_API_KEY),
      masterStored: Boolean(await loadStoredMaster(env)),
    };
    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
  });

  return server;
}

async function handleMcp(request, env, ctx) {
  const auth = authorized(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: { message: auth.message } }), {
      status: auth.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'WWW-Authenticate': 'Bearer realm="resume-studio"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const baseUrl = new URL(request.url).origin;
  const handler = createMcpHandler(() => createResumeMcpServer(env, baseUrl), {
    route: MCP_ROUTE,
    corsOptions: false,
  });
  const executionCtx = ctx || { waitUntil() {}, passThroughOnException() {} };
  return handler(request, env, executionCtx);
}

async function handleFile(request, env, id) {
  if (request.method !== 'GET') return apiError('Method not allowed. Use GET.', 405);
  if (!/^[a-f0-9]{32}$/.test(id)) return apiError('File not found.', 404);
  if (!env.RESUME_MASTER) return apiError('File storage is not configured.', 500);

  let stored = null;
  try {
    stored = await env.RESUME_MASTER.getWithMetadata(`pdf:${id}`, 'arrayBuffer');
  } catch {
    stored = null;
  }
  const bytes = stored?.value;
  if (!bytes) return apiError('File not found or expired.', 404);

  const filename = sanitizeFilename(stored.metadata?.filename, 'Naveen_Morla_Resume');
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function handleTailorPdf(request, env) {
  const auth = authorized(request, env);
  if (!auth.ok) return apiError(auth.message, auth.status);
  if (request.method !== 'POST') return apiError('Method not allowed. Use POST.', 405);

  const parsed = await readJsonBody(request, MAX_PDF_BODY_BYTES);
  if (parsed.error) return apiError(parsed.error, parsed.status);

  const body = parsed.body;
  const ai = body.ai !== false && Boolean(env.DEEPSEEK_API_KEY);
  const company = String(body.company || '').trim().slice(0, 80);
  const jobTitle = String(body.jobTitle || '').trim().slice(0, 120);
  const filename = pdfFilename(company, body.filename, jobTitle);

  if (body.ai === true && !env.DEEPSEEK_API_KEY) {
    return apiError('ai was requested but DEEPSEEK_API_KEY is not configured.', 400);
  }

  let master = body.master;
  if (master !== undefined) {
    if (!isMaster(master)) {
      return apiError('master must be a resume master with a profile and at least one experience role.', 400);
    }
  } else {
    master = await loadStoredMaster(env);
    if (!isMaster(master)) {
      return apiError('No master resume is stored. Upload it with PUT /master or send master in the request.', 409);
    }
  }

  try {
    const { jd, source } = await resolveJobDescription(env, {
      jobDescription: body.jobDescription,
      jobUrl: body.jobUrl,
      company,
      jobTitle,
    });
    const { pdf, meta } = await generatePdf(env, { master, jd, ai });
    const id = await storePdf(env, pdf, filename);
    await recordHistory(env, {
      status: 'ok',
      source: 'api',
      ai,
      filename,
      company,
      role: meta.role || jobTitle,
      score: meta.score,
      delta: meta.delta,
      projects: meta.projects,
      fileId: id,
      jobSource: source?.url || '',
    });
    const headers = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    };
    if (id) headers['X-Resume-File-Url'] = `${new URL(request.url).origin}${FILE_ROUTE_PREFIX}${id}`;
    return new Response(pdf, { status: 200, headers });
  } catch (error) {
    await recordHistory(env, {
      status: 'error',
      source: 'api',
      ai,
      filename,
      company,
      role: jobTitle,
      error: error?.message || 'unknown error',
      jobSource: normalizeHttpUrl(body.jobUrl) || '',
    });
    const status = Number(error?.status);
    const httpStatus = status >= 400 && status < 500 ? status : 502;
    return apiError(`Resume generation failed: ${error?.message || 'unknown error'}`, httpStatus);
  }
}

async function handleFetchJd(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  if (origin && !allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: { message: 'Origin not allowed.' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: fetchJdCorsHeaders(origin) });
  }

  const auth = authorizedForBrowserRoute(request, env, origin, allowed);
  if (!auth.ok) return fetchJdJson({ error: { message: auth.message } }, auth.status, origin);
  if (request.method !== 'POST') {
    return fetchJdJson({ error: { message: 'Method not allowed. Use POST.' } }, 405, origin);
  }

  const parsed = await readJsonBody(request, MAX_PDF_BODY_BYTES);
  if (parsed.error) return fetchJdJson({ error: { message: parsed.error } }, parsed.status, origin);
  const body = parsed.body;

  try {
    const result = await fetchJobDescriptionFromUrl(env, {
      url: body.url || body.jobUrl,
      company: String(body.company || '').trim().slice(0, 80),
      jobTitle: String(body.jobTitle || body.title || '').trim().slice(0, 120),
    });
    return fetchJdJson({
      ok: true,
      title: result.title,
      url: result.url,
      source: result.source,
      chars: result.text.length,
      text: result.text,
    }, 200, origin);
  } catch (error) {
    const status = Number(error?.status);
    const httpStatus = status >= 400 && status < 500 ? status : 502;
    return fetchJdJson({ error: { message: error?.message || 'Could not read the job posting.' } }, httpStatus, origin);
  }
}

async function handleHistory(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  if (origin && !allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: { message: 'Origin not allowed.' } }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: historyCorsHeaders(origin) });
  }

  const auth = authorizedForBrowserRoute(request, env, origin, allowed);
  if (!auth.ok) return historyJson({ error: { message: auth.message } }, auth.status, origin);
  if (request.method !== 'GET') {
    return historyJson({ error: { message: 'Method not allowed. Use GET.' } }, 405, origin);
  }
  if (!env.RESUME_MASTER) {
    return historyJson({ error: { message: 'History storage is not configured.' } }, 500, origin);
  }

  let listed;
  try {
    listed = await env.RESUME_MASTER.list({ prefix: HISTORY_PREFIX, limit: HISTORY_LIMIT });
  } catch {
    return historyJson({ error: { message: 'Could not read history.' } }, 500, origin);
  }
  const items = (listed?.keys || [])
    .map((entry) => entry.metadata)
    .filter(Boolean)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return historyJson({
    ok: true,
    items,
    count: items.length,
    listComplete: Boolean(listed?.list_complete),
  }, 200, origin);
}

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    if (url.pathname === PDF_ROUTE) return handleTailorPdf(request, env);
    if (url.pathname === MASTER_ROUTE) return handleMaster(request, env);
    if (url.pathname === HEALTH_ROUTE) return handleHealth(env);
    if (url.pathname === MCP_ROUTE) return handleMcp(request, env, ctx);
    if (url.pathname === HISTORY_ROUTE) return handleHistory(request, env);
    if (url.pathname === FETCH_JD_ROUTE) return handleFetchJd(request, env);
    if (url.pathname.startsWith(FILE_ROUTE_PREFIX)) {
      return handleFile(request, env, url.pathname.slice(FILE_ROUTE_PREFIX.length));
    }

    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigins(env);
    // The proxy is for the deployed app and local testing only. This check
    // stops another website from calling it from a browser. It is not a
    // substitute for user authentication; the DeepSeek key itself never
    // leaves this Worker.
    if (!origin || !allowed.includes(origin)) {
      return new Response(JSON.stringify({ error: { message: 'Origin not allowed.' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed.', 405, origin);
    }
    if (!env.DEEPSEEK_API_KEY) {
      return errorResponse('Proxy is not configured with DEEPSEEK_API_KEY.', 500, origin);
    }

    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return errorResponse('Request body is too large.', 413, origin);
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse('Invalid JSON body.', 400, origin);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('JSON body must be an object.', 400, origin);
    }

    // Cap cost and prevent the browser from switching to an unexpected model.
    body.stream = false;
    body.model = ALLOWED_MODELS.has(body.model) ? body.model : 'deepseek-flash';
    const requestedTokens = Number(body.max_tokens);
    body.max_tokens = Number.isFinite(requestedTokens)
      ? Math.max(1, Math.min(MAX_TOKENS, Math.floor(requestedTokens)))
      : 2600;

    let upstream;
    try {
      upstream = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch {
      return errorResponse('Could not reach DeepSeek from the proxy.', 502, origin);
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
        ...corsHeaders(origin),
      },
    });
  },
};
