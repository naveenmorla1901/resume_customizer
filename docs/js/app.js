import { SAMPLE_JD } from './demo-data.js';
import {
  DEFAULT_AI_SETTINGS,
  AiError,
  hasAiAccess,
  normalizeProxyUrl,
  requestAiPlan,
  testConnection,
} from './ai.js';
import {
  buildAtsReport,
  extractUnknownTerms,
} from './ats.js';
import { createDocxBlob } from './docx-export.js';
import { importResumeFile } from './docx-import.js';
import { emphasizePlan } from './emphasis.js';
import { SAFETY_PX, basePlan, fitPlan } from './fit.js';
import {
  applyResumeFill,
  getPlainText,
  renderResume,
  renderResumeHtml,
} from './render.js';
import {
  clearAll,
  clearPlan,
  clearSessionApiKey,
  exportMasterJson,
  hasContact,
  isOnboarded,
  loadJd,
  loadMaster,
  loadPlan,
  loadSettings,
  saveJd,
  saveMaster,
  savePlan,
  saveSettings,
  setOnboarded,
  starterMaster,
  updateContact,
} from './store.js';
import {
  fetchJobDescription,
  isUrlOnly,
  normalizeUrl,
} from './jd-import.js';
import { recordRun } from './run-history.js';
import {
  addJdKeywords,
  buildLocalPlan,
  defaultProjects,
  leadLatestRoleWithJd,
  mirrorJobTitle,
  scrubRecruiterNoise,
  materializePlan,
  planStats,
} from './tailor.js';
import {
  clearWorkerToken,
  loadWorkerToken,
  saveWorkerToken,
} from './worker-token.js';
import {
  compactTitle,
  copyText,
  shortRoleTitle,
  debounce,
  downloadBlob,
  downloadText,
  sanitizeFilename,
} from './util.js';

const $ = (id) => document.getElementById(id);

const state = {
  master: loadMaster(),
  settings: loadSettings(),
  plan: null,
  jd: '',
  tailoredJd: '',
  report: null,
  baseReport: null,
  measurement: null,
  busy: false,
  abort: null,
  previewScale: 1,
};

const DEFAULT_TAILOR_NOTE = 'Tailoring keeps your wording factual: it selects, reorders, aligns, and trims existing content.';
let lastAutoLoadedUrl = '';
let documentTitleBeforePrint = '';

function workerEndpoint() {
  try {
    return normalizeProxyUrl(state.settings?.proxyUrl || '');
  } catch {
    return '';
  }
}

function updateCloudReaderState() {
  // The deployed site is an allowed Worker origin, so the cloud reader is
  // always on; a token is only an override for other hosts.
  const node = $('cloud-reader-state');
  if (!node) return;
  node.textContent = 'On';
  node.classList.add('on');
}

/* ------------------------------------------------------------------ */
/* Small UI helpers                                                    */
/* ------------------------------------------------------------------ */

function toast(message, kind = '') {
  const root = $('toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast ${kind}`.trim();
  node.textContent = message;
  root.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    node.style.transition = 'opacity .2s ease, transform .2s ease';
    setTimeout(() => node.remove(), 220);
  }, 4600);
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.hidden = false;
  if (id === 'contact-modal') {
    renderContactForm();
    setTimeout(() => {
      const target = $('contact-phone').value ? $('contact-phone') : $('contact-name');
      target?.focus();
    }, 30);
  }
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.hidden = true;
  if (id === 'welcome-modal') setOnboarded(true);
}

function setLoading(title, text, cancellable = false) {
  $('loading-title').textContent = title;
  $('loading-text').textContent = text;
  $('btn-cancel-loading').hidden = !cancellable;
  $('loading-modal').hidden = false;
}

function updateLoading(text) {
  $('loading-text').textContent = text;
}

function hideLoading() {
  $('loading-modal').hidden = true;
  $('btn-cancel-loading').hidden = true;
}

function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

function setBadge(node, text, kind = '') {
  node.textContent = text;
  node.className = `badge ${kind}`.trim();
}

/* ------------------------------------------------------------------ */
/* Resume header / master card                                         */
/* ------------------------------------------------------------------ */

function projectMeta(master) {
  const total = master.projects?.length || 0;
  if (!total) return '0 projects';
  const shown = defaultProjects(master).length;
  return total > shown ? `${shown} of ${total} projects shown` : `${total} project${total === 1 ? '' : 's'}`;
}

function updateMasterCard() {
  const { master } = state;
  const profile = master.profile || {};
  const roles = master.experience?.length || 0;
  const skills = (master.skills || []).reduce((sum, group) => sum + (group.items?.length || 0), 0);
  const isImported = Boolean(master.meta?.imported);
  const isStarter = Boolean(master.meta?.starter) && !isImported;

  $('resume-name').textContent = profile.name || 'Untitled resume';
  setBadge($('resume-badge'), isImported ? 'Imported' : isStarter ? 'Starter' : 'Master', 'badge-muted');

  const updated = master.meta?.updated ? ` · updated ${master.meta.updated}` : '';
  const projects = projectMeta(master);
  $('resume-meta').textContent = `${roles} role${roles === 1 ? '' : 's'} · ${projects} · ${skills} skills${updated}`;

  $('contact-warning').hidden = hasContact(master);
  $('settings-meta').textContent = `${profile.name || 'Resume'} · ${roles} roles · ${projects} · ${skills} skills${updated}`;
}

function requireContact(action) {
  if (hasContact(state.master)) return true;
  toast(`Add a phone number and email before ${action}.`, 'error');
  openModal('contact-modal');
  return false;
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

function scalePreview() {
  const mount = $('preview-mount');
  const scaleNode = $('preview-scale');
  const viewport = $('preview-viewport');
  const page = mount?.querySelector('.resume-page');
  if (!page || !scaleNode || !viewport) return;

  const naturalWidth = page.offsetWidth || 816;
  const naturalHeight = mount.scrollHeight || 2112;
  const available = Math.max(220, viewport.clientWidth - 44);
  const scale = Math.min(1, available / naturalWidth);

  state.previewScale = scale;
  scaleNode.style.width = `${Math.round(naturalWidth * scale)}px`;
  scaleNode.style.height = `${Math.round(naturalHeight * scale)}px`;
  scaleNode.style.overflow = 'hidden';
  scaleNode.style.transform = `scale(${scale})`;
  scaleNode.style.transformOrigin = 'top left';
  mount.style.width = `${naturalWidth}px`;
}

function updatePreviewStatus(displayPlan, measurement) {
  // After the fill pass, a page intentionally ends near the bottom margin.
  // Keep only a small visual buffer for this status; the fitter separately
  // reserves SAFETY_PX before fill is applied.
  const pagesFit = measurement.page1.overflow <= -10 && measurement.page2.overflow <= -10;
  const fitted = displayPlan.fitInfo ? Boolean(displayPlan.fitInfo.fitted) : pagesFit;
  const badge = $('fit-status');

  $('page-status').textContent = 'Two Letter pages';
  if (fitted) {
    setBadge(badge, displayPlan.source === 'base' ? 'Original fit' : 'Fits two pages', 'badge-good');
  } else {
    setBadge(badge, 'Needs a trim', 'badge-warn');
  }
}

function renderPreview() {
  let displayPlan = state.plan || basePlan(state.master);
  if (state.report && displayPlan.source !== 'base') {
    // Older saved plans may predate the emphasis pass. Reapply it so the
    // preview, PDF, and DOCX all keep the same bold terms.
    displayPlan = emphasizePlan(displayPlan, state.report);
  }
  state.plan = displayPlan;
  renderResume($('preview-mount'), state.master, displayPlan);
  const filled = applyResumeFill($('preview-mount'));
  displayPlan.layout = filled.layout;
  state.measurement = filled.measurement;
  updatePreviewStatus(displayPlan, state.measurement);
  requestAnimationFrame(scalePreview);
  return state.measurement;
}

/* ------------------------------------------------------------------ */
/* ATS report                                                          */
/* ------------------------------------------------------------------ */

function addChip(container, text, kind, title = '') {
  const chip = document.createElement('span');
  chip.className = `chip ${kind}`.trim();
  chip.textContent = text;
  if (title) chip.title = title;
  container.appendChild(chip);
}

function renderChipList(container, items, kind, emptyText, limit = 18, metaFn = null) {
  container.innerHTML = '';
  if (!items.length) {
    addChip(container, emptyText, 'more');
    return;
  }
  for (const item of items.slice(0, limit)) {
    const meta = metaFn
      ? metaFn(item)
      : [
        item.count ? `${item.count} mention${item.count === 1 ? '' : 's'}` : '',
        item.required ? 'required' : item.preferred ? 'preferred' : '',
      ].filter(Boolean).join(' · ');
    addChip(container, item.name, kind, meta);
  }
  if (items.length > limit) {
    addChip(container, `+${items.length - limit} more`, 'more');
  }
}

function setScoreColor(score) {
  const ring = $('score-ring');
  const color = score >= 75 ? '#137a4b' : score >= 55 ? '#a15c05' : '#b42318';
  ring.style.setProperty('--score-color', color);
}

function renderAts(baseReport, report) {
  const reportJd = state.tailoredJd || state.jd;
  if (!report || !reportJd) {
    $('ats-card').hidden = true;
    $('notes-card').hidden = true;
    return;
  }

  $('ats-card').hidden = false;

  const score = report.score;
  $('score-value').textContent = String(score);
  $('score-ring').style.setProperty('--score', String(score));
  setScoreColor(score);

  $('keyword-score').textContent = `${report.keywordScore}%`;
  $('keyword-meter').style.width = `${report.keywordScore}%`;
  $('title-score').textContent = `${report.titleScore}%`;
  $('title-meter').style.width = `${report.titleScore}%`;
  $('format-score').textContent = `${report.formatScore}%`;
  $('format-meter').style.width = `${report.formatScore}%`;

  const focusLine = $('focus-line');
  if (focusLine) {
    if (report.focusScore === null || report.focusScore === undefined) {
      focusLine.hidden = true;
    } else {
      focusLine.hidden = false;
      $('focus-score').textContent = `${report.focusScore}%`;
      $('focus-meter').style.width = `${report.focusScore}%`;
    }
  }

  $('ats-heading').textContent = report.title || 'Match report';
  setBadge($('ats-confidence'), `${report.confidence} confidence`, 'badge-muted');

  const matched = report.matched.filter((keyword) => keyword.score);
  const fillKeywords = state.settings.addJdKeywords !== false;
  const addedKeywords = Array.isArray(state.plan?.addedKeywords) ? state.plan.addedKeywords : [];
  const baseMatchedNames = new Set((baseReport?.matched || []).map((keyword) => keyword.name));
  const missing = report.missing
    .filter((keyword) => keyword.score)
    .map((keyword) => ({ ...keyword, inMaster: baseMatchedNames.has(keyword.name) }));
  $('matched-count').textContent = String(matched.length);
  $('missing-count').textContent = String(missing.length);
  renderChipList($('matched-chips'), matched, 'good', 'No scored keywords matched yet.');
  renderChipList(
    $('missing-chips'),
    missing,
    'miss',
    'No taxonomy keywords missing.',
    18,
    (item) => [
      item.required ? 'required' : item.preferred ? 'preferred' : '',
      item.inMaster
        ? 'in your master, not selected in this version'
        : fillKeywords ? 'not in your resume — no room to add' : 'not in your resume — not auto-added',
    ].filter(Boolean).join(' · '),
  );

  const absent = missing.filter((keyword) => !keyword.inMaster);
  const omitted = missing.filter((keyword) => keyword.inMaster);
  const unknown = extractUnknownTerms(reportJd, report.resumeText);
  const focusAreas = report.focusAreas || [];
  const unsupportedFocus = report.unsupportedFocus || [];
  const parts = [];
  if (focusAreas.length) {
    parts.push(`Transferable focus supported by your resume: ${focusAreas.map((area) => area.label).join(', ')}.`);
  }
  if (addedKeywords.length) {
    parts.push(`Added from the job description (not in your master resume): ${addedKeywords.join(', ')}. Be ready to discuss these in an interview.`);
  }
  if (unsupportedFocus.length) {
    parts.push(`JD focus areas not supported by your resume: ${unsupportedFocus.map((area) => area.label).join(', ')}.${fillKeywords ? '' : ' These are not auto-added; turn on "Fill missing job keywords" in Settings to add them.'}`);
  }
  if (omitted.length) {
    parts.push(`Still in your master but not in this tailored version: ${omitted.map((k) => k.name).join(', ')}. Tailor again if the fit allows more room.`);
  }
  if (absent.length) {
    const required = absent.filter((keyword) => keyword.required).map((keyword) => keyword.name);
    if (fillKeywords) {
      parts.push(`Still missing after filling job keywords (the two-page limit had no room): ${absent.map((keyword) => keyword.name).join(', ')}.`);
    } else {
      const label = required.length ? `Required by the JD but absent from your resume: ${required.join(', ')}.` : `Not in your resume, so not auto-added: ${absent.map((keyword) => keyword.name).join(', ')}.`;
      parts.push(`${label} Turn on "Fill missing job keywords" in Settings to add them.`);
    }
  }
  if (unknown.length) {
    parts.push(`Also review: ${unknown.join(', ')}. These are outside the controlled skill list, so they were not auto-added.`);
  }
  const note = $('missing-note');
  if (parts.length) {
    note.hidden = false;
    note.textContent = parts.join('\n');
  } else {
    note.hidden = true;
    note.textContent = '';
  }

  const list = $('checks-list');
  list.innerHTML = '';
  for (const check of report.checks) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${check.pass ? '✓' : '!'} ${check.label}:`;
    if (!check.pass) strong.style.color = '#a15c05';
    const text = document.createElement('span');
    text.textContent = ` ${check.detail}`;
    li.append(strong, text);
    list.appendChild(li);
  }

  const delta = $('score-delta');
  if (baseReport && baseReport !== report) {
    const change = report.score - baseReport.score;
    delta.hidden = false;
    delta.style.background = change < 0 ? 'var(--warn-bg)' : '';
    delta.style.borderColor = change < 0 ? '#f1d6ae' : '';
    delta.style.color = change < 0 ? '#7a4707' : '';
    delta.textContent = change > 0
      ? `+${change} ATS match points from tailoring (baseline ${baseReport.score} → ${report.score}).`
      : change === 0
        ? `ATS match unchanged at ${report.score}. Review the missing keywords below.`
        : `ATS match moved from ${baseReport.score} to ${report.score}. Review the missing keywords below.`;
  } else {
    delta.hidden = true;
  }
}

function describeFit(fitInfo) {
  if (!fitInfo) return '';
  const changes = fitInfo.changes || {};
  const bits = [];
  if (changes.summaryTrimmed) bits.push(`shortened the summary ${changes.summaryTrimmed}×`);
  if (changes.experienceTrimmed) bits.push(`trimmed ${changes.experienceTrimmed} older-role bullet${changes.experienceTrimmed === 1 ? '' : 's'}`);
  if (changes.projectBulletsTrimmed) bits.push(`trimmed ${changes.projectBulletsTrimmed} project bullet${changes.projectBulletsTrimmed === 1 ? '' : 's'}`);
  if (changes.projectsDropped) bits.push(`removed ${changes.projectsDropped} lower-priority project${changes.projectsDropped === 1 ? '' : 's'}`);
  if (changes.skillsTrimmed) bits.push(`shortened ${changes.skillsTrimmed} skill group${changes.skillsTrimmed === 1 ? '' : 's'}`);
  if (changes.groupsDropped) bits.push(`removed ${changes.groupsDropped} lower-priority skill group${changes.groupsDropped === 1 ? '' : 's'}`);
  if (changes.certsTrimmed) bits.push(`trimmed ${changes.certsTrimmed} certification${changes.certsTrimmed === 1 ? '' : 's'}`);

  if (!bits.length) {
    return fitInfo.fitted
      ? 'All master content fit on two pages; the plan only reordered and emphasized existing content.'
      : 'The content is still tight. Import a shorter master resume or remove a project before exporting.';
  }
  return `To keep two pages: ${bits.join(', ')}. The preview and the DOCX use the same plan.`;
}

function renderNotes(displayPlan) {
  if (!displayPlan || displayPlan.source === 'base') {
    $('notes-card').hidden = true;
    return;
  }

  const notes = [];
  if (!(displayPlan.notes || []).length) {
    notes.push(displayPlan.source === 'deepseek'
      ? 'DeepSeek selected and ordered existing content for this job. Any rewording kept the existing facts, tools, metrics, and dates.'
      : 'Local tailoring selected, reordered, and trimmed existing content using the job description keywords.');
  }
  for (const note of displayPlan.notes || []) notes.push(note);
  if (displayPlan.fitInfo) notes.push(describeFit(displayPlan.fitInfo));

  const unique = [...new Set(notes.filter(Boolean))];
  const list = $('notes-list');
  list.innerHTML = '';
  for (const note of unique) {
    const li = document.createElement('li');
    li.textContent = note;
    list.appendChild(li);
  }
  $('notes-card').hidden = !unique.length;
}

function refreshReports() {
  const jd = (state.tailoredJd || state.jd).trim();
  const displayPlan = state.plan;
  if (!jd || !displayPlan || displayPlan.source === 'base') {
    $('ats-card').hidden = true;
    $('notes-card').hidden = true;
    return;
  }

  const tailored = materializePlan(state.master, displayPlan);
  state.baseReport = buildAtsReport(state.master, jd);
  state.report = buildAtsReport(tailored, jd);
  renderAts(state.baseReport, state.report);
  renderNotes(displayPlan);
}

/* ------------------------------------------------------------------ */
/* Contact modal                                                       */
/* ------------------------------------------------------------------ */

function addContactLinkRow(link = { label: '', url: '' }) {
  const row = document.createElement('div');
  row.className = 'link-row';

  const label = document.createElement('input');
  label.type = 'text';
  label.placeholder = 'Label (LinkedIn)';
  label.value = link.label || '';
  label.dataset.role = 'label';
  label.setAttribute('aria-label', 'Link label');

  const url = document.createElement('input');
  url.type = 'url';
  url.placeholder = 'https://…';
  url.value = link.url || '';
  url.dataset.role = 'url';
  url.setAttribute('aria-label', 'Link URL');

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-btn';
  remove.setAttribute('aria-label', 'Remove link');
  remove.textContent = '×';
  remove.addEventListener('click', () => row.remove());

  row.append(label, url, remove);
  $('contact-links').appendChild(row);
}

function renderContactForm() {
  const profile = state.master.profile || {};
  $('contact-name').value = profile.name || '';
  $('contact-phone').value = profile.phone || '';
  $('contact-email').value = profile.email || '';

  const mount = $('contact-links');
  mount.innerHTML = '';
  const links = profile.links || [];
  for (const link of links) addContactLinkRow(link);
  if (!links.length) addContactLinkRow();
}

function saveContactFromForm(event) {
  event.preventDefault();
  const links = Array.from($('contact-links').querySelectorAll('.link-row'))
    .map((row) => ({
      label: row.querySelector('[data-role="label"]').value.trim(),
      url: row.querySelector('[data-role="url"]').value.trim(),
    }))
    .filter((link) => link.label && link.url);

  state.master = updateContact(state.master, {
    name: $('contact-name').value.trim(),
    phone: $('contact-phone').value.trim(),
    email: $('contact-email').value.trim(),
    links,
  });
  saveMaster(state.master);
  setOnboarded(true);
  closeModal('contact-modal');
  updateMasterCard();
  renderPreview();
  refreshReports();
  toast('Contact details saved in this browser.', 'success');
}

/* ------------------------------------------------------------------ */
/* Settings modal                                                      */
/* ------------------------------------------------------------------ */

function proxyModeSelected() {
  return $('setting-connection').value === 'proxy';
}

function syncConnectionFields() {
  const proxy = proxyModeSelected();
  $('direct-key-fields').hidden = proxy;
  $('proxy-fields').hidden = !proxy;
  $('btn-forget-key').hidden = proxy || !state.settings.apiKey;
}

function syncSettingsUi() {
  const settings = state.settings;
  // Never prefill the key: it is intentionally invisible after it is entered.
  $('setting-key').value = '';
  $('setting-model').value = settings.model || DEFAULT_AI_SETTINGS.model;
  $('setting-endpoint').value = settings.endpoint || DEFAULT_AI_SETTINGS.endpoint;
  $('setting-key').type = 'password';
  $('setting-key').autocomplete = 'new-password';
  $('btn-toggle-key').textContent = 'Show';
  $('setting-connection').value = settings.connectionMode === 'proxy' ? 'proxy' : 'direct';
  $('setting-proxy-url').value = settings.proxyUrl || '';
  syncConnectionFields();
  if (settings.connectionMode === 'proxy') {
    setApiStatus(settings.proxyUrl ? 'Secure proxy configured. No key in this browser.' : 'Proxy URL not set.');
  } else {
    setApiStatus(settings.apiKey ? 'Key loaded for this tab only. It is cleared on reload.' : 'No key in this tab.');
  }
  $('setting-rewrite').checked = settings.rewriteBullets !== false;
  $('setting-add-keywords').checked = settings.addJdKeywords !== false;
  $('setting-mirror-title').checked = settings.mirrorJobTitle !== false;
  $('setting-lead-bullets').checked = settings.leadWithJdBullets !== false;
  $('ai-toggle').checked = Boolean(settings.useAI);
  updateAiHint();
  updateMasterCard();
}

function setApiStatus(text, kind = '') {
  const node = $('api-status');
  node.textContent = text;
  node.className = `api-status ${kind}`.trim();
}

function updateAiHint() {
  const hint = $('ai-hint');
  if (!hint) return;
  const proxy = state.settings.connectionMode === 'proxy';
  const configured = hasAiAccess(state.settings);
  if (configured) {
    if (state.settings.useAI) {
      const rewrite = state.settings.rewriteBullets !== false
        ? ' It can also reword the summary and latest role while keeping the same facts.'
        : '';
      hint.textContent = proxy
        ? `DeepSeek (${state.settings.model || DEFAULT_AI_SETTINGS.model}) will use the secure proxy. The key stays in the server-side secret.${rewrite}`
        : `DeepSeek (${state.settings.model || DEFAULT_AI_SETTINGS.model}) will select existing content for this job.${rewrite} The key is kept in memory for this tab only.`;
    } else {
      hint.textContent = 'DeepSeek is off. Local tailoring will select, reorder, align, and trim existing content.';
    }
  } else {
    hint.textContent = proxy
      ? 'Add the secure proxy URL in Settings. Local tailoring will be used until then.'
      : 'No API key in this tab. Local tailoring will reorder, align, and trim existing content.';
  }
}

function saveSettingsFromForm() {
  const proxy = proxyModeSelected();
  let proxyUrl = '';
  if (proxy) {
    try {
      proxyUrl = normalizeProxyUrl($('setting-proxy-url').value);
    } catch (error) {
      setApiStatus(error.message, 'bad');
      return;
    }
  }
  const typedKey = $('setting-key').value.trim();
  state.settings = {
    ...state.settings,
    // Switching to the proxy clears the direct key from this tab.
    apiKey: proxy ? '' : (typedKey || state.settings.apiKey || ''),
    connectionMode: proxy ? 'proxy' : 'direct',
    proxyUrl,
    model: $('setting-model').value.trim() || DEFAULT_AI_SETTINGS.model,
    endpoint: $('setting-endpoint').value.trim() || DEFAULT_AI_SETTINGS.endpoint,
    useAI: $('ai-toggle').checked,
    rewriteBullets: $('setting-rewrite').checked,
    addJdKeywords: $('setting-add-keywords').checked,
    mirrorJobTitle: $('setting-mirror-title').checked,
    leadWithJdBullets: $('setting-lead-bullets').checked,
  };
  saveSettings(state.settings);
  $('setting-key').value = '';
  updateAiHint();
  closeModal('settings-modal');
  if (proxy) {
    toast(
      proxyUrl
        ? 'Settings saved. AI requests will use the secure proxy.'
        : 'Settings saved. Add a proxy URL before using AI.',
      proxyUrl ? 'success' : '',
    );
  } else {
    toast(
      typedKey
        ? 'Settings saved. The API key is kept in memory for this tab only.'
        : 'Settings saved. The API key is never written to browser storage.',
      'success',
    );
  }
}

function forgetApiKey() {
  state.settings = { ...state.settings, apiKey: '' };
  clearSessionApiKey();
  saveSettings(state.settings);
  $('setting-key').value = '';
  setApiStatus('Key removed from this tab.', '');
  $('btn-forget-key').hidden = true;
  updateAiHint();
}

async function testApiConnection() {
  const button = $('btn-test-api');
  const proxy = proxyModeSelected();
  let proxyUrl = '';
  if (proxy) {
    try {
      proxyUrl = normalizeProxyUrl($('setting-proxy-url').value);
    } catch (error) {
      setApiStatus(error.message, 'bad');
      return;
    }
  }
  const settings = {
    ...state.settings,
    apiKey: proxy ? '' : ($('setting-key').value.trim() || state.settings.apiKey || ''),
    connectionMode: proxy ? 'proxy' : 'direct',
    proxyUrl,
    model: $('setting-model').value.trim() || DEFAULT_AI_SETTINGS.model,
    endpoint: $('setting-endpoint').value.trim() || DEFAULT_AI_SETTINGS.endpoint,
  };
  if (!hasAiAccess(settings)) {
    setApiStatus(proxy ? 'Enter the secure proxy URL first.' : 'Enter an API key first.', 'bad');
    return;
  }
  button.disabled = true;
  setApiStatus('Testing…');
  try {
    const result = await testConnection(settings);
    setApiStatus(`Connected${proxy ? ' via secure proxy' : ''} · ${result.latency} ms`, 'good');
  } catch (error) {
    setApiStatus(error.message || 'Connection failed.', 'bad');
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Tailoring                                                           */
/* ------------------------------------------------------------------ */

function currentJd() {
  return $('jd-input').value.trim();
}

function updateJdCount() {
  const length = $('jd-input').value.length;
  $('jd-count').textContent = `${length.toLocaleString()} character${length === 1 ? '' : 's'}`;
}

function applyJdText(value, { persist = true } = {}) {
  $('jd-input').value = value;
  state.jd = value;
  updateJdCount();
  if (persist) saveJd(value);
  updateTailorNote();
}

const persistJd = debounce(() => saveJd($('jd-input').value), 350);

function setUrlLoading(loading) {
  const button = $('btn-load-url');
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Reading…' : 'Load URL';
  $('jd-input').setAttribute('aria-busy', loading ? 'true' : 'false');
}

async function loadJdFromUrl(value, opts = {}) {
  const raw = String(value || '').trim() || currentJd();
  const url = normalizeUrl(raw);
  if (!url) {
    toast('Enter a valid http(s) job posting URL.', 'error');
    $('jd-url').focus();
    return '';
  }
  const token = ($('jd-token')?.value || '').trim() || loadWorkerToken();
  setUrlLoading(true);
  try {
    const result = await fetchJobDescription(url, {
      token,
      endpoint: workerEndpoint(),
    });
    lastAutoLoadedUrl = '';
    applyJdText(result.text);
    $('jd-url').value = '';
    const note = result.warning
      ? `Loaded via ${result.source}. ${result.warning}`
      : `Loaded via ${result.source}. Review it, then tailor.`;
    updateLoadingTextNow(note);
    toast(
      result.warning
        ? `Loaded via ${result.source}. ${result.warning}`
        : `Loaded the full job post via ${result.source}.`,
      result.warning ? '' : 'success',
    );
    if (opts.focus !== false) $('jd-input').focus();
    return result.text;
  } catch (error) {
    lastAutoLoadedUrl = '';
    if (error.name === 'AbortError') {
      toast('Stopped reading the job URL.', '');
    } else {
      toast(error.message || 'Could not read that job URL. Paste the description instead.', 'error');
    }
    return '';
  } finally {
    setUrlLoading(false);
  }
}

function updateLoadingTextNow(message) {
  // Used only for a non-modal URL-load confirmation. Keeping it separate from
  // the tailoring loading modal avoids covering the page while fetching.
  const note = $('jd-url-status');
  if (!note) return;
  note.textContent = message || '';
  note.hidden = !message;
  if (message) {
    clearTimeout(updateLoadingTextNow.timer);
    updateLoadingTextNow.timer = setTimeout(() => {
      note.hidden = true;
    }, 6000);
  }
}

async function resolveJdInput() {
  let jd = currentJd();
  if (isUrlOnly(jd)) {
    const loaded = await loadJdFromUrl(jd, { focus: false });
    if (!loaded) return '';
    jd = currentJd();
  }
  return jd;
}

function updateTailorNote() {
  const note = $('tailor-note');
  if (!note) return;
  const jd = currentJd();
  if (state.tailoredJd && jd && jd !== state.tailoredJd) {
    note.textContent = 'The job description changed. Tailor again to refresh the selection and the ATS report.';
    return;
  }
  if (state.plan && state.plan.source === 'deepseek') {
    note.textContent = 'DeepSeek selected existing content and may have reworded the summary and latest role. Review the notes and ATS report before exporting.';
  } else if (state.plan && state.plan.source === 'local') {
    note.textContent = 'Local tailoring keeps your wording factual: it selected, aligned, reordered, and trimmed existing content.';
  } else {
    note.textContent = DEFAULT_TAILOR_NOTE;
  }
}

function attachFitInfo(plan, fit) {
  plan.fitInfo = {
    fitted: fit.fitted,
    safety: fit.safety,
    changes: fit.changes,
    at: new Date().toISOString(),
  };
  return plan;
}

async function tailorResume() {
  if (state.busy) return;
  if ($('btn-load-url')?.disabled) {
    toast('Still reading the job posting URL. Try again in a moment.', '');
    return;
  }
  const jd = await resolveJdInput();
  if (!jd || jd.length < 80) {
    toast('Paste the full job description or a job posting URL first.', 'error');
    $('jd-input').focus();
    return;
  }

  state.busy = true;
  state.abort = new AbortController();
  $('btn-tailor').disabled = true;
  setLoading('Tailoring your resume', 'Analyzing the job description…', true);
  await nextFrame();

  try {
    const baseReport = buildAtsReport(state.master, jd);
    const wantsAi = $('ai-toggle').checked && hasAiAccess(state.settings);
    let nextPlan;

    if (wantsAi) {
      updateLoading('Asking DeepSeek to select the strongest existing content…');
      try {
        nextPlan = await requestAiPlan({
          master: state.master,
          jd,
          report: baseReport,
          settings: state.settings,
          signal: state.abort.signal,
        });
      } catch (error) {
        if (state.abort.signal.aborted) {
          toast('Tailoring cancelled.', '');
          return;
        }
        const message = error instanceof AiError ? error.message : 'DeepSeek could not complete the request.';
        toast(`${message} Local tailoring was used instead.`, 'error');
        nextPlan = buildLocalPlan(state.master, jd, baseReport);
        nextPlan.notes = [...(nextPlan.notes || []), 'DeepSeek was unavailable, so local selection was used.'];
      }
    } else {
      if ($('ai-toggle').checked && !hasAiAccess(state.settings)) {
        toast(state.settings.connectionMode === 'proxy'
          ? 'No secure proxy URL set. Local tailoring is being used.'
          : 'No API key in this tab. Local tailoring is being used.', '');
      }
      updateLoading('Selecting and aligning the strongest existing content…');
      nextPlan = buildLocalPlan(state.master, jd, baseReport);
    }

    if (state.settings.mirrorJobTitle !== false) {
      nextPlan = mirrorJobTitle(nextPlan, state.master, jd);
    }
    if (state.settings.leadWithJdBullets !== false) {
      nextPlan = leadLatestRoleWithJd(nextPlan, state.master, jd);
    }
    if (state.settings.addJdKeywords !== false) {
      nextPlan = addJdKeywords(nextPlan, state.master, jd);
    }
    nextPlan = scrubRecruiterNoise(nextPlan);

    updateLoading('Fitting the resume to two Letter pages…');
    await nextFrame();
    const fit = fitPlan(state.master, nextPlan, $('measure-stage'));
    const fittedPlan = attachFitInfo(fit.plan, fit);

    state.plan = fittedPlan;
    state.jd = jd;
    state.tailoredJd = jd;
    saveJd(jd);
    savePlan(fittedPlan);
    saveSettings(state.settings);

    const tailored = materializePlan(state.master, fittedPlan);
    state.baseReport = baseReport;
    state.report = buildAtsReport(tailored, jd);

    const targetTitle = state.report.title || 'Resume';
    const selectedProjects = (fittedPlan.projects || [])
      .map((selected) => (state.master.projects || []).find((project) => project.id === selected.id)?.name)
      .filter(Boolean);
    const scoreDelta = state.report.score - baseReport.score;
    recordRun({
      mode: fittedPlan.source === 'deepseek' ? 'ai' : 'local',
      filename: `${resumeFileBase()}.pdf`,
      role: targetTitle,
      score: state.report.score,
      delta: scoreDelta > 0
        ? `+${scoreDelta} ATS points from tailoring`
        : scoreDelta === 0
          ? 'ATS match unchanged'
          : `${scoreDelta} ATS points from tailoring`,
      projects: selectedProjects,
      dedupeKey: `${targetTitle}|${state.report.score}|${jd.length}|${jd.slice(0, 160)}|${selectedProjects.join(',')}`,
    });

    renderPreview();
    savePlan(state.plan);
    renderAts(state.baseReport, state.report);
    renderNotes(fittedPlan);
    updateMasterCard();
    updateTailorNote();
    scalePreview();

    const stats = planStats(fittedPlan);
    const source = fittedPlan.source === 'deepseek' ? 'DeepSeek' : 'Local tailoring';
    const fitText = fit.fitted ? 'fits two pages' : 'is still tight';
    toast(`${source}: ${stats.experience} experience bullets, ${stats.projects} project bullets, ${stats.groups} skill groups. Preview ${fitText}.`, fit.fitted ? 'success' : 'error');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Tailoring failed. Try again.', 'error');
  } finally {
    state.busy = false;
    state.abort = null;
    $('btn-tailor').disabled = false;
    hideLoading();
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function ensurePlanFits() {
  if (!state.plan) state.plan = basePlan(state.master);
  const measurement = renderResume($('measure-stage'), state.master, state.plan);
  const fits = measurement.page1.overflow <= -SAFETY_PX && measurement.page2.overflow <= -SAFETY_PX;
  if (fits) return true;

  const fit = fitPlan(state.master, state.plan, $('measure-stage'));
  state.plan = attachFitInfo(fit.plan, fit);
  savePlan(state.plan);
  renderPreview();
  renderNotes(state.plan);
  toast('A few lower-priority details were trimmed so Word stays on two pages.', '');
  return fit.fitted;
}

function resumeFileBase() {
  const name = state.master.profile?.name || 'Resume';
  const title = shortRoleTitle(state.report?.title || state.baseReport?.title || '');
  return sanitizeFilename(`${name}_${title || 'Resume'}`);
}

async function downloadDocx() {
  if (!requireContact('exporting')) return;
  if (!globalThis.docx?.Packer) {
    toast('The Word generator did not load. Refresh the page and try again.', 'error');
    return;
  }

  const button = $('btn-download');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Building…';
  try {
    ensurePlanFits();
    const displayPlan = state.plan || basePlan(state.master);
    const tailored = materializePlan(state.master, displayPlan);
    const targetTitle = state.report?.title || state.baseReport?.title || 'Resume';
    const name = state.master.profile?.name || 'Resume';
    const filename = `${resumeFileBase()}.docx`;

    const blob = await createDocxBlob(globalThis.docx, state.master, tailored, {
      title: `${name} — ${compactTitle(targetTitle) || 'Resume'}`,
      subject: `Resume tailored for ${targetTitle}`,
      keywords: (state.report?.keywords || []).slice(0, 20).map((keyword) => keyword.name).join(', '),
    });
    downloadBlob(blob, filename);
    toast('DOCX downloaded. Open it in Word and review the final pages.', 'success');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Could not build the DOCX. Try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/**
 * Chrome, Edge, and Firefox use document.title as the default PDF filename.
 * Set it only for the print call, then restore the tab title afterwards.
 * beforeprint also covers Ctrl+P, and the guard prevents double-saving.
 */
function preparePrintTitle() {
  if (documentTitleBeforePrint) return;
  documentTitleBeforePrint = document.title;
  document.title = resumeFileBase();
}

async function printPdf() {
  if (!requireContact('printing')) return;
  ensurePlanFits();
  $('print-root').innerHTML = renderResumeHtml(state.master, state.plan || basePlan(state.master));
  try {
    await document.fonts.ready;
  } catch {
    // Font loading is best-effort.
  }
  preparePrintTitle();
  window.print();
}

async function copyResumeText() {
  try {
    const text = getPlainText(state.master, state.plan || basePlan(state.master));
    await copyText(text);
    toast('Resume text copied. Paste it into a form or an email.', 'success');
  } catch {
    toast('Could not copy the resume text. Try Download DOCX instead.', 'error');
  }
}

/* ------------------------------------------------------------------ */
/* Import / reset / data                                               */
/* ------------------------------------------------------------------ */

function applyMaster(master, message) {
  state.master = master;
  state.plan = null;
  state.report = null;
  state.baseReport = null;
  state.tailoredJd = '';
  saveMaster(master);
  clearPlan();
  updateMasterCard();
  renderPreview();
  $('ats-card').hidden = true;
  $('notes-card').hidden = true;
  updateTailorNote();
  scalePreview();
  if (message) toast(message, 'success');
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const imported = await importResumeFile(file);
    applyMaster(imported, `Imported ${file.name}. Check the contact details and the two-page preview.`);
    setOnboarded(true);
    closeModal('welcome-modal');
    closeModal('settings-modal');
    if (!hasContact(imported)) {
      setTimeout(() => openModal('contact-modal'), 250);
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Could not import that file.', 'error');
  } finally {
    $('file-input').value = '';
  }
}

function resetToStarter() {
  if (!window.confirm('Replace the current resume with the starter resume? Your tailored plan will be cleared.')) return;
  const starter = starterMaster();
  state.master = starter;
  state.plan = null;
  state.report = null;
  state.baseReport = null;
  state.tailoredJd = '';
  saveMaster(starter);
  clearPlan();
  applyJdText('', { persist: true });
  $('ats-card').hidden = true;
  $('notes-card').hidden = true;
  updateMasterCard();
  renderPreview();
  scalePreview();
  closeModal('settings-modal');
  toast('Starter resume restored. Add your contact details before exporting.', '');
}

function exportJson() {
  const name = state.master.profile?.name || 'resume';
  downloadText(
    exportMasterJson(state.master),
    `${sanitizeFilename(`${name}_master`)}.json`,
    'application/json',
  );
  toast('Master data exported. Keep this file private — it contains your contact details.', 'success');
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function bindEvents() {
  // Modals
  document.addEventListener('click', (event) => {
    const closer = event.target.closest('[data-close]');
    if (closer) closeModal(closer.dataset.close);
    if (event.target.classList?.contains('modal-backdrop')) closeModal(event.target.id);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const loading = $('loading-modal');
    if (!loading.hidden) {
      if (!$('btn-cancel-loading').hidden) $('btn-cancel-loading').click();
      return;
    }
    const open = Array.from(document.querySelectorAll('.modal-backdrop:not([hidden])')).pop();
    if (open) closeModal(open.id);
  });

  // Welcome
  $('btn-welcome-starter').addEventListener('click', () => {
    setOnboarded(true);
    closeModal('welcome-modal');
    if (!hasContact(state.master)) setTimeout(() => openModal('contact-modal'), 220);
  });
  $('btn-welcome-import').addEventListener('click', () => $('file-input').click());

  // Contact
  $('btn-contact').addEventListener('click', () => openModal('contact-modal'));
  $('btn-contact-warning').addEventListener('click', () => openModal('contact-modal'));
  $('btn-add-link').addEventListener('click', () => {
    if ($('contact-links').children.length >= 5) {
      toast('Keep the contact line short: five links is the maximum.', '');
      return;
    }
    addContactLinkRow();
  });
  $('contact-form').addEventListener('submit', saveContactFromForm);

  // Settings
  $('btn-settings').addEventListener('click', () => {
    syncSettingsUi();
    openModal('settings-modal');
  });
  $('btn-help').addEventListener('click', () => openModal('help-modal'));
  $('btn-ai-settings').addEventListener('click', () => {
    syncSettingsUi();
    openModal('settings-modal');
    setTimeout(() => {
      const target = proxyModeSelected() ? $('setting-proxy-url') : $('setting-key');
      target.focus();
    }, 40);
  });
  $('btn-save-settings').addEventListener('click', saveSettingsFromForm);
  $('btn-test-api').addEventListener('click', testApiConnection);
  $('btn-forget-key').addEventListener('click', forgetApiKey);
  $('setting-connection').addEventListener('change', () => {
    syncConnectionFields();
    if (proxyModeSelected()) {
      setApiStatus($('setting-proxy-url').value.trim()
        ? 'Secure proxy configured. No key in this browser.'
        : 'Proxy URL not set.');
    } else {
      setApiStatus(state.settings.apiKey
        ? 'Key loaded for this tab only. It is cleared on reload.'
        : 'No key in this tab.');
    }
  });
  $('btn-toggle-key').addEventListener('click', () => {
    const input = $('setting-key');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('btn-toggle-key').textContent = show ? 'Hide' : 'Show';
  });
  $('btn-settings-import').addEventListener('click', () => $('file-input').click());
  $('btn-export-json').addEventListener('click', exportJson);
  $('btn-reset-starter').addEventListener('click', resetToStarter);
  $('btn-clear-all').addEventListener('click', () => {
    if (!window.confirm('Clear the resume, job description, plan, saved settings, Worker token, and browser run history from this device? The in-memory API key is also cleared.')) return;
    clearAll();
    window.location.reload();
  });

  // JD + tailoring
  const autoReadUrl = debounce(() => {
    const value = currentJd();
    if (!isUrlOnly(value) || value === lastAutoLoadedUrl) return;
    lastAutoLoadedUrl = value;
    loadJdFromUrl(value, { focus: false });
  }, 700);
  $('jd-input').addEventListener('input', () => {
    state.jd = $('jd-input').value;
    updateJdCount();
    updateTailorNote();
    persistJd();
    autoReadUrl();
  });
  $('btn-load-url').addEventListener('click', () => {
    const value = $('jd-url').value.trim() || currentJd();
    loadJdFromUrl(value);
  });
  $('jd-url').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadJdFromUrl($('jd-url').value.trim() || currentJd());
  });
  $('btn-sample').addEventListener('click', () => {
    applyJdText(SAMPLE_JD);
    lastAutoLoadedUrl = '';
    $('jd-url').value = '';
    updateLoadingTextNow('');
    $('jd-input').focus();
    toast('Sample job description loaded. Tailor when you are ready.', '');
  });
  const jdTokenInput = $('jd-token');
  if (jdTokenInput) {
    jdTokenInput.value = loadWorkerToken();
    updateCloudReaderState();
    jdTokenInput.addEventListener('input', () => {
      saveWorkerToken(jdTokenInput.value);
      updateCloudReaderState();
    });
    $('btn-clear-jd-token')?.addEventListener('click', () => {
      jdTokenInput.value = '';
      clearWorkerToken();
      updateCloudReaderState();
      jdTokenInput.focus();
    });
  }
  $('ai-toggle').addEventListener('change', () => {
    state.settings = { ...state.settings, useAI: $('ai-toggle').checked };
    saveSettings(state.settings);
    updateAiHint();
    if ($('ai-toggle').checked && !hasAiAccess(state.settings)) {
      toast(state.settings.connectionMode === 'proxy'
        ? 'Add the secure proxy URL in Settings, or leave AI off for local tailoring.'
        : 'Enter a DeepSeek API key in Settings for this tab, or leave AI off for local tailoring.', '');
    }
  });
  $('btn-tailor').addEventListener('click', tailorResume);
  $('btn-cancel-loading').addEventListener('click', () => {
    state.abort?.abort();
    hideLoading();
  });

  // Preview actions
  $('btn-download').addEventListener('click', downloadDocx);
  $('btn-print').addEventListener('click', printPdf);
  $('btn-copy').addEventListener('click', copyResumeText);
  window.addEventListener('beforeprint', preparePrintTitle);
  window.addEventListener('afterprint', () => {
    $('print-root').innerHTML = '';
    if (documentTitleBeforePrint) {
      document.title = documentTitleBeforePrint;
      documentTitleBeforePrint = '';
    }
  });

  // Import
  $('file-input').addEventListener('change', () => handleImportFile($('file-input').files?.[0]));

  // Preview scaling
  if ('ResizeObserver' in window) {
    new ResizeObserver(debounce(scalePreview, 60)).observe($('preview-viewport'));
  }
  window.addEventListener('resize', debounce(scalePreview, 80));
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  bindEvents();
  state.jd = loadJd();
  $('jd-input').value = state.jd;
  updateJdCount();
  syncSettingsUi();
  updateMasterCard();

  try {
    await document.fonts.ready;
  } catch {
    // Continue with the system font fallback.
  }

  const savedPlan = loadPlan();
  if (savedPlan) {
    state.plan = savedPlan;
    if (savedPlan.source && savedPlan.source !== 'base') state.tailoredJd = state.jd;
  } else {
    state.plan = basePlan(state.master);
  }

  renderPreview();
  refreshReports();
  updateTailorNote();
  scalePreview();

  if (!isOnboarded()) openModal('welcome-modal');
}

init();
