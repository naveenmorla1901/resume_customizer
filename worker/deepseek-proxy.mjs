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
const FILE_ROUTE_PREFIX = '/files/';
const FILE_TTL_SECONDS = 60 * 60;
const APP_URL = 'https://naveenmorla1901.github.io/resume_customizer/';
const PROXY_URL = 'https://resume-deepseek-proxy.morla-naveen1901.workers.dev';
const MAX_PDF_BODY_BYTES = 128 * 1024;
const MAX_MASTER_BODY_BYTES = 128 * 1024;
const MIN_JD_CHARS = 20;
const MAX_JD_CHARS = 20_000;
const PDF_TIMEOUT_MS = 60_000;
const TAILOR_TIMEOUT_MS = 90_000;

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
    .replace(/[^a-z0-9._ -]+/gi, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/[\s_]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 120);
  return `${base || fallback}.pdf`;
}

function pdfFilename(company, requested) {
  const safe = String(company || '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  const fallback = `Naveen_Morla_Resume${safe ? `_${safe}` : ''}_${date}`;
  return sanitizeFilename(requested, fallback);
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

    await page.click('#btn-print');
    await page.waitForFunction(
      () => document.querySelectorAll('#print-root .resume-page').length === 2,
      { timeout: 30_000 },
    );

    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
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
  });
}

function createResumeMcpServer(env, baseUrl) {
  const server = new McpServer({ name: 'resume-studio', version: '1.0.0' });

  server.registerTool('tailor_resume', {
    title: 'Tailor resume to a job description',
    description: [
      'Create a tailored two-page PDF resume from a job description and return a temporary download link.',
      'Use this whenever the user provides a job description or asks for a resume tailored to a role.',
      'The resume is built from Naveen Morla\'s stored master resume and keeps the existing two-page layout, fonts, and clickable project links.',
      'Pass filename when the user asks for a specific output filename; the .pdf extension is added automatically.',
      'Set ai=true only when the user explicitly wants DeepSeek rewording; otherwise leave it false for fast, deterministic tailoring.',
    ].join(' '),
    inputSchema: z.object({
      jobDescription: z.string().min(MIN_JD_CHARS).max(MAX_JD_CHARS).describe('The complete job description text, not just the job title.'),
      company: z.string().max(80).optional().describe('Company name used in the default filename and confirmation message.'),
      ai: z.boolean().optional().describe('true = DeepSeek rewrites the summary and latest role; false or omitted = deterministic local tailoring (default).'),
      filename: z.string().max(140).optional().describe('Exact output filename requested by the user, for example "Naveen_Morla_Acme_Data_Engineer.pdf".'),
    }),
  }, async ({ jobDescription, company, ai, filename }) => {
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

      const pdf = await generatePdf(env, { master, jd: jobDescription, ai: ai === true });
      const name = pdfFilename(company, filename);
      const id = await storePdf(env, pdf, name);
      const url = id ? `${baseUrl}${FILE_ROUTE_PREFIX}${id}` : null;
      const mode = ai === true ? 'DeepSeek AI rewrite' : 'deterministic local tailoring';
      const lines = [
        `Resume PDF generated with ${mode}.`,
        `Filename: ${name}`,
        url
          ? `Download (link expires in 60 minutes): ${url}`
          : 'Temporary file storage is unavailable. Use POST /tailor.pdf to download the PDF directly.',
        'The PDF keeps the two-page layout, clickable project links, and the "Private project" label for MS-FTAE.',
      ];
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
      return {
        isError: true,
        content: [{ type: 'text', text: `PDF generation failed: ${error?.message || 'unknown error'}` }],
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
  const jd = String(body.jobDescription || '').trim();
  if (jd.length < MIN_JD_CHARS || jd.length > MAX_JD_CHARS) {
    return apiError(`jobDescription must be between ${MIN_JD_CHARS} and ${MAX_JD_CHARS} characters.`, 400);
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

  const ai = body.ai === true;
  if (ai && !env.DEEPSEEK_API_KEY) {
    return apiError('ai was requested but DEEPSEEK_API_KEY is not configured.', 400);
  }

  const company = String(body.company || '').trim().slice(0, 80);
  const filename = pdfFilename(company, body.filename);

  try {
    const pdf = await generatePdf(env, { master, jd, ai });
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(`PDF generation failed: ${error?.message || 'unknown error'}`, 502);
  }
}

export default {
  async fetch(request, env = {}, ctx) {
    const url = new URL(request.url);
    if (url.pathname === PDF_ROUTE) return handleTailorPdf(request, env);
    if (url.pathname === MASTER_ROUTE) return handleMaster(request, env);
    if (url.pathname === HEALTH_ROUTE) return handleHealth(env);
    if (url.pathname === MCP_ROUTE) return handleMcp(request, env, ctx);
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
