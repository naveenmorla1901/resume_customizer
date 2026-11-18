import { escapeHtml } from './util.js';

const DEFAULT_ENDPOINT = 'https://resume-deepseek-proxy.morla-naveen1901.workers.dev';
const TOKEN_KEY = 'resumeStudio.workerToken';
const LEGACY_TOKEN_KEY = 'resumeStudio.historyToken';
const SETTINGS_KEY = 'resumeStudio.v1.settings';

const $ = (id) => document.getElementById(id);

function loadSavedToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
      || sessionStorage.getItem(LEGACY_TOKEN_KEY)
      || '';
  } catch {
    return '';
  }
}

function saveToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // The request can still use the value from the input.
  }
}

function readSavedProxyUrl() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return saved?.connectionMode === 'proxy' ? String(saved.proxyUrl || '') : '';
  } catch {
    return '';
  }
}

function normalizeEndpoint(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return '';
    if (url.username || url.password) return '';
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function apiBase() {
  // A query override is only for local testing. Accepting an arbitrary remote
  // host here could trick a saved token into being sent to another server.
  const fromQuery = normalizeEndpoint(new URLSearchParams(location.search).get('proxy') || '');
  const localQuery = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(fromQuery)
    ? fromQuery
    : '';
  return localQuery
    || normalizeEndpoint(readSavedProxyUrl())
    || DEFAULT_ENDPOINT;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return /^https?:$/i.test(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function scoreOf(item) {
  if (!item || item.score === null || item.score === undefined || item.score === '') return null;
  const score = Number(item.score);
  return Number.isFinite(score) ? score : null;
}

function showMessage(text = '', tone = '') {
  const node = $('history-message');
  node.textContent = text;
  node.hidden = !text;
  node.className = `mini-note history-message${tone ? ` ${tone}` : ''}`;
}

function setStatus(text) {
  $('history-status-text').textContent = text;
}

function setBusy(busy) {
  $('btn-history-load').disabled = busy;
  $('btn-history-refresh').disabled = busy;
  $('history-token').setAttribute('aria-busy', busy ? 'true' : 'false');
  $('btn-history-load').textContent = busy ? 'Loading…' : 'Load history';
}

function renderSummary(items) {
  const successful = items.filter((item) => item.status !== 'error');
  const failed = items.filter((item) => item.status === 'error');
  const scored = items.filter((item) => item.status === 'ok' && scoreOf(item) !== null);

  $('summary-ok').textContent = String(successful.length);
  $('summary-error').textContent = String(failed.length);

  const latestNode = $('summary-latest');
  const changeNode = $('summary-change');
  latestNode.className = '';
  changeNode.className = '';

  if (!scored.length) {
    latestNode.textContent = '—';
    changeNode.textContent = '—';
    return;
  }

  const latest = scoreOf(scored[0]);
  latestNode.textContent = `${Math.round(latest)}/100`;

  const previous = scored.length > 1 ? scoreOf(scored[1]) : null;
  if (previous === null) {
    changeNode.textContent = 'First scored call';
    changeNode.className = 'muted';
    return;
  }

  const change = latest - previous;
  if (change > 0) {
    changeNode.textContent = `+${Math.round(change)} pts`;
    changeNode.className = 'good';
  } else if (change < 0) {
    changeNode.textContent = `${Math.round(change)} pts`;
    changeNode.className = 'warn';
  } else {
    changeNode.textContent = 'No change';
    changeNode.className = 'muted';
  }
}

function renderItem(item) {
  const failed = item.status === 'error';
  const status = failed
    ? '<span class="badge badge-danger">Failed</span>'
    : '<span class="badge badge-good">Generated</span>';
  const title = escapeHtml(item.filename || 'Resume.pdf');
  const mode = item.mode === 'ai' ? 'DeepSeek AI rewrite' : 'Local tailoring';
  const role = [item.company, item.role].filter(Boolean).join(' · ');
  const jobUrl = safeHttpUrl(item.jobSource);
  const metaBits = [
    escapeHtml(formatDate(item.at)),
    escapeHtml(mode),
    role ? escapeHtml(role) : '',
    jobUrl
      ? `<a href="${escapeHtml(jobUrl)}" target="_blank" rel="noopener noreferrer">Job posting</a>`
      : '',
  ].filter(Boolean);

  const projects = Array.isArray(item.projects)
    ? item.projects.map((project) => escapeHtml(project)).filter(Boolean)
    : [];
  const score = scoreOf(item);
  const expired = item.expiresAt ? Date.parse(item.expiresAt) <= Date.now() : false;
  let download = '';
  if (item.fileId && !expired) {
    const href = `${apiBase()}/files/${encodeURIComponent(item.fileId)}`;
    download = `<a class="btn btn-ghost btn-sm" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Download PDF</a>`;
  } else if (item.fileId && expired) {
    download = '<span class="history-expired">Download link expired</span>';
  }

  return `
    <article class="history-item">
      <div class="history-item-main">
        <div class="history-item-title">
          <strong>${title}</strong>
          ${status}
        </div>
        <p class="history-item-meta">${metaBits.join(' · ')}</p>
        ${projects.length ? `<p class="history-item-projects">Projects: ${projects.join(' · ')}</p>` : ''}
        ${item.delta ? `<p class="history-item-note">ATS note: ${escapeHtml(item.delta)}</p>` : ''}
        ${item.error ? `<p class="history-item-note error">${escapeHtml(item.error)}</p>` : ''}
      </div>
      <div class="history-item-side">
        ${score === null
          ? '<span class="history-expired">No score</span>'
          : `<div class="history-score"><strong>${Math.round(score)}</strong><span>ATS score</span></div>`}
        ${download}
      </div>
    </article>
  `;
}

function render(items) {
  const list = $('history-list');
  const empty = $('history-empty');
  list.innerHTML = items.map(renderItem).join('');
  empty.hidden = items.length > 0;
  empty.textContent = items.length
    ? ''
    : 'No cloud calls yet. Run the MCP tool or POST /tailor.pdf, then refresh this page.';

  $('history-count').textContent = `${items.length} call${items.length === 1 ? '' : 's'}`;
  $('history-summary').hidden = items.length === 0;
  renderSummary(items);
  setStatus(`${items.length} call${items.length === 1 ? '' : 's'} loaded`);
}

async function loadHistory() {
  const token = ($('history-token').value || '').trim() || loadSavedToken();
  if (!token) {
    showMessage('Enter the Worker token to load the history.', 'error');
    $('history-token').focus();
    return;
  }

  saveToken(token);
  setBusy(true);
  setStatus('Loading…');
  showMessage('');

  try {
    const response = await fetch(`${apiBase()}/history`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Token rejected. Use the PDF_API_TOKEN configured on the Worker.');
      }
      throw new Error(data?.error?.message || `The Worker returned HTTP ${response.status}.`);
    }

    const items = (Array.isArray(data?.items) ? data.items : [])
      .slice()
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    render(items);
  } catch (error) {
    setStatus('Load failed');
    const message = error?.message === 'Failed to fetch'
      ? 'Could not reach the Worker. Check the endpoint and that this site is an allowed origin.'
      : error?.message || 'Could not load the history.';
    showMessage(message, 'error');
  } finally {
    setBusy(false);
  }
}

const tokenInput = $('history-token');
const savedToken = loadSavedToken();
if (savedToken) tokenInput.value = savedToken;

$('history-endpoint').textContent = `Worker: ${apiBase()}`;
$('btn-history-refresh').addEventListener('click', () => {
  if (!($('history-token').value || '').trim()) {
    $('history-token').focus();
    showMessage('Enter the Worker token to load the history.', 'error');
    return;
  }
  loadHistory();
});
$('history-token-form').addEventListener('submit', (event) => {
  event.preventDefault();
  loadHistory();
});

if (savedToken) loadHistory();
