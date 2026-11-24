/**
 * The Worker token is a bearer token for the optional Cloudflare proxy. It is
 * safe to keep on this device between visits, but it is not a public value:
 * anyone with it can call the proxy. Keep it in localStorage, offer a Clear
 * action, and never put it in the repository or a URL.
 *
 * Older builds stored the token in sessionStorage. loadWorkerToken() migrates
 * that value once so existing users do not have to paste it again.
 */
const TOKEN_KEY = 'resumeStudio.workerToken';
const LEGACY_KEYS = ['resumeStudio.historyToken'];

function read(storage, key) {
  try {
    return String(storage.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function remove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures (private mode, quota, embedded contexts).
  }
}

export function loadWorkerToken() {
  const saved = read(localStorage, TOKEN_KEY);
  if (saved) {
    // Drop any stale tab-only copy now that the persistent one is available.
    [TOKEN_KEY, ...LEGACY_KEYS].forEach((key) => remove(sessionStorage, key));
    return saved;
  }

  for (const key of [TOKEN_KEY, ...LEGACY_KEYS]) {
    const legacy = read(sessionStorage, key);
    if (legacy) {
      saveWorkerToken(legacy);
      return legacy;
    }
  }
  return '';
}

export function saveWorkerToken(value) {
  const token = String(value || '').trim();
  if (!token) {
    clearWorkerToken();
    return '';
  }

  // Prefer persistent storage. If the browser blocks it (private mode or a
  // quota error), keep the token for this tab so the feature still works.
  const persisted = write(localStorage, TOKEN_KEY, token);
  if (persisted) {
    [TOKEN_KEY, ...LEGACY_KEYS].forEach((key) => remove(sessionStorage, key));
  } else {
    write(sessionStorage, TOKEN_KEY, token);
    LEGACY_KEYS.forEach((key) => remove(sessionStorage, key));
  }
  return token;
}

export function clearWorkerToken() {
  remove(localStorage, TOKEN_KEY);
  [TOKEN_KEY, ...LEGACY_KEYS].forEach((key) => remove(sessionStorage, key));
}
