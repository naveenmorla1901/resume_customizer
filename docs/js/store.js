import { STARTER_MASTER } from './demo-data.js';
import { DEFAULT_AI_SETTINGS } from './ai.js';
import { RUNS_KEY } from './run-history.js';
import { clearWorkerToken } from './worker-token.js';

const PREFIX = 'resumeStudio.v1';
export const KEYS = {
  master: `${PREFIX}.master`,
  settings: `${PREFIX}.settings`,
  jd: `${PREFIX}.jd`,
  plan: `${PREFIX}.plan`,
  onboarded: `${PREFIX}.onboarded`,
  runs: RUNS_KEY,
};

// The API key deliberately lives in memory only. It is never written to
// localStorage, so a reload or a shared browser starts without a key.
let sessionApiKey = '';

export function getSessionApiKey() {
  return sessionApiKey;
}

export function setSessionApiKey(value) {
  sessionApiKey = String(value || '').trim();
  return sessionApiKey;
}

export function clearSessionApiKey() {
  sessionApiKey = '';
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}

export function starterMaster() {
  return JSON.parse(JSON.stringify(STARTER_MASTER));
}

export function loadMaster() {
  const saved = read(KEYS.master, null);
  if (saved && Array.isArray(saved.experience) && saved.experience.length) return saved;
  return starterMaster();
}

export function saveMaster(master) {
  return write(KEYS.master, master);
}

export function clearMaster() {
  remove(KEYS.master);
  remove(KEYS.plan);
}

export function loadSettings() {
  const saved = read(KEYS.settings, {}) || {};
  // Migrate away from the old behaviour that persisted the key. Remove it
  // from localStorage as soon as the app loads.
  if (Object.prototype.hasOwnProperty.call(saved, 'apiKey')) {
    const { apiKey, ...safe } = saved;
    write(KEYS.settings, safe);
    return { ...DEFAULT_AI_SETTINGS, ...safe, apiKey: '' };
  }
  return { ...DEFAULT_AI_SETTINGS, ...saved, apiKey: '' };
}

export function saveSettings(settings) {
  const { apiKey, ...safe } = settings || {};
  if (apiKey !== undefined) setSessionApiKey(apiKey);
  return write(KEYS.settings, safe);
}

export function loadJd() {
  return read(KEYS.jd, '') || '';
}

export function saveJd(value) {
  return write(KEYS.jd, String(value || ''));
}

export function loadPlan() {
  return read(KEYS.plan, null);
}

export function savePlan(plan) {
  return write(KEYS.plan, plan);
}

export function clearPlan() {
  remove(KEYS.plan);
}

export function isOnboarded() {
  return read(KEYS.onboarded, false) === true;
}

export function setOnboarded(value = true) {
  write(KEYS.onboarded, value);
}

export function hasContact(master) {
  return Boolean(master?.profile?.phone && master?.profile?.email);
}

export function updateContact(master, contact = {}) {
  return {
    ...master,
    profile: {
      ...(master.profile || {}),
      name: contact.name ?? master.profile?.name ?? '',
      phone: contact.phone ?? master.profile?.phone ?? '',
      email: contact.email ?? master.profile?.email ?? '',
      links: Array.isArray(contact.links) ? contact.links.filter((l) => l.label && l.url) : (master.profile?.links || []),
    },
  };
}

export function exportMasterJson(master) {
  return JSON.stringify(master, null, 2);
}

export function clearAll() {
  Object.values(KEYS).forEach(remove);
  clearWorkerToken();
  clearSessionApiKey();
}
