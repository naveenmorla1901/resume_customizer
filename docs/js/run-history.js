/**
 * Local tailoring runs. These are metadata only (no resume text, no job
 * description) and stay in this browser. The History page merges them with
 * the Worker's cloud/MCP log so every run appears in one place.
 */
const RUNS_KEY = 'resumeStudio.v1.runs';
const MAX_RUNS = 50;

function read() {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const objects = parsed.filter((item) => item && typeof item === 'object');
    let changed = objects.length !== parsed.length;
    const runs = objects
      .map((item) => {
        if (!Object.prototype.hasOwnProperty.call(item, 'dedupeKey')) return item;
        // Older builds saved the raw dedupe key, which included a slice of the
        // job description. Replace it with the fingerprint and drop the text.
        const { dedupeKey, ...rest } = item;
        changed = true;
        if (dedupeKey) rest.dedupe = rest.dedupe || fingerprint(dedupeKey);
        return rest;
      });
    if (changed) write(runs);
    return runs;
  } catch {
    return [];
  }
}

function write(runs) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}

// A non-reversible fingerprint lets recordRun() suppress an immediate repeat
// without ever storing the job description itself.
function fingerprint(value = '') {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function loadRuns() {
  return read();
}

export function recordRun(entry = {}) {
  const at = entry.at || new Date().toISOString();
  const { dedupeKey, ...metadata } = entry;
  const item = {
    id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at,
    status: 'ok',
    source: 'web',
    mode: 'local',
    filename: '',
    company: '',
    role: '',
    score: null,
    delta: '',
    projects: [],
    ...metadata,
    ...(dedupeKey ? { dedupe: fingerprint(dedupeKey) } : {}),
  };

  const runs = read();
  const last = runs[0];
  // Tailoring the same JD twice in a row should not create duplicate noise.
  if (
    last
    && item.dedupe
    && last.dedupe === item.dedupe
    && Date.parse(at) - Date.parse(last.at) < 60_000
  ) {
    return last;
  }

  runs.unshift(item);
  write(runs.slice(0, MAX_RUNS));
  return item;
}

export function clearRuns() {
  try {
    localStorage.removeItem(RUNS_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export { RUNS_KEY };
