import { escapeHtml } from './util.js';
import { clearRuns, loadRuns } from './run-history.js';
import { clearWorkerToken, loadWorkerToken, saveWorkerToken } from './worker-token.js';

const DEFAULT_ENDPOINT = 'https://resume-deepseek-proxy.morla-naveen1901.workers.dev';
const SETTINGS_KEY = 'resumeStudio.v1.settings';

const $ = (id) => document.getElementById(id);

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
  $('btn-history-clear-token').disabled = busy;
  $('btn-clear-local-runs').disabled = busy;
  $('history-token').setAttribute('aria-busy', busy ? 'true' : 'false');
  $('btn-history-load').textContent = busy ? 'Loading…' : 'Reload history';
}

function localRuns() {
  return loadRuns().map((run) => ({ ...run, source: 'web' }));
}

function sourceBadge(item) {
  if (item.source === 'web') return '<span class="badge badge-muted">This browser</span>';
  if (item.source === 'mcp') return '<span class="badge badge-muted">MCP</span>';
  if (item.source === 'api') return '<span class="badge badge-muted">Cloud API</span>';
  return '<span class="badge badge-muted">Cloud</span>';
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
          ${sourceBadge(item)}
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
    : 'No runs yet. Tailor a resume in the studio, or run the MCP tool.';

  $('history-count').textContent = `${items.length} run${items.length === 1 ? '' : 's'}`;
  $('history-summary').hidden = items.length === 0;
  renderSummary(items);
  setStatus(`${items.length} run${items.length === 1 ? '' : 's'} loaded`);
}

async function loadHistory() {
  const tokenInput = $('history-token');
  const typed = String(tokenInput.value || '').trim();
  const token = typed || loadWorkerToken();
  if (typed) saveWorkerToken(typed);

  const local = localRuns();
  setBusy(true);
  setStatus('Loading…');
  showMessage('');

  try {
    // The deployed site is an allowed Worker origin, so the token is optional.
    const response = await fetch(`${apiBase()}/history`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('The Worker did not accept this page. Make sure this site is in the Worker\'s allowed origins.');
      }
      throw new Error(data?.error?.message || `The Worker returned HTTP ${response.status}.`);
    }

    const cloud = (Array.isArray(data?.items) ? data.items : [])
      .map((item) => ({ ...item, source: item.source || 'api' }));
    const merged = [...cloud, ...local]
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    render(merged);
    if (!cloud.length && local.length) {
      showMessage('No cloud calls yet; showing runs from this browser.', '');
    }
  } catch (error) {
    render(local);
    setStatus(local.length ? 'Local runs only' : 'Load failed');
    const message = error?.message === 'Failed to fetch'
      ? 'Could not reach the Worker. Check the endpoint and that this site is an allowed origin.'
      : error?.message || 'Could not load the cloud history.';
    showMessage(`${message}${local.length ? ' Showing runs from this browser.' : ''}`, 'error');
  } finally {
    setBusy(false);
  }
}

const tokenInput = $('history-token');
const savedToken = loadWorkerToken();
if (savedToken) tokenInput.value = savedToken;

$('history-endpoint').textContent = `Worker: ${apiBase()}`;
$('btn-history-refresh').addEventListener('click', () => loadHistory());
$('btn-history-clear-token').addEventListener('click', () => {
  clearWorkerToken();
  tokenInput.value = '';
  loadHistory();
});
$('btn-clear-local-runs').addEventListener('click', () => {
  const confirmed = window.confirm(
    'Remove browser-run history from this device? Cloud and MCP history is not affected.',
  );
  if (!confirmed) return;
  clearRuns();
  loadHistory();
});
$('history-token-form').addEventListener('submit', (event) => {
  event.preventDefault();
  saveWorkerToken(tokenInput.value);
  loadHistory();
});

loadHistory();
