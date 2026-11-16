const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://naveenmorla1901.github.io',
  'http://127.0.0.1:8765',
  'http://localhost:8765',
];
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_TOKENS = 4000;
const ALLOWED_MODELS = new Set(['deepseek-flash', 'deepseek-v4-pro']);

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

export default {
  async fetch(request, env = {}) {
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
