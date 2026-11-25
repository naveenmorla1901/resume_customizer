/**
 * Turn a job description's responsibility lines into past-tense resume
 * bullets ("Design and deploy LLM agents" -> "Designed and deployed LLM
 * agents"). Used to lead the latest role with the job's own language.
 */
import { TAXONOMY } from './taxonomy.js';
import { countTerm } from './ats.js';
import { normalizeText } from './util.js';

const IRREGULAR = {
  build: 'built', lead: 'led', drive: 'drove', run: 'ran', write: 'wrote', make: 'made',
  hold: 'held', take: 'took', bring: 'brought', keep: 'kept', grow: 'grew', teach: 'taught',
  find: 'found', oversee: 'oversaw', undertake: 'undertook', set: 'set', put: 'put',
  plan: 'planned', ship: 'shipped', map: 'mapped', commit: 'committed', control: 'controlled',
  forecast: 'forecasted', spearhead: 'spearheaded', 'fine-tune': 'fine-tuned',
};

const REGULAR = [
  'design', 'develop', 'deploy', 'implement', 'create', 'architect', 'engineer', 'analyze',
  'analyse', 'automate', 'optimize', 'optimise', 'maintain', 'monitor', 'manage', 'collaborate',
  'partner', 'deliver', 'improve', 'establish', 'define', 'evaluate', 'research', 'prototype',
  'scale', 'integrate', 'mentor', 'support', 'translate', 'communicate', 'present', 'identify',
  'conduct', 'perform', 'ensure', 'apply', 'train', 'validate', 'test', 'document', 'coordinate',
  'prioritize', 'champion', 'contribute', 'enable', 'streamline', 'transform', 'migrate', 'model',
  'measure', 'track', 'report', 'investigate', 'troubleshoot', 'resolve', 'review', 'operate',
  'administer', 'configure', 'guide', 'influence', 'shape', 'explore', 'experiment', 'launch',
  'productionize', 'orchestrate', 'curate', 'collect', 'clean', 'process', 'visualize', 'extract',
  'leverage', 'utilize', 'work', 'assist', 'help', 'advise', 'recommend', 'provide', 'produce',
  'prepare', 'propose', 'execute', 'facilitate', 'serve', 'own', 'accelerate', 'architect',
  'benchmark', 'craft', 'debug', 'derive', 'fine-tune', 'formulate', 'harden', 'instrument',
  'interpret', 'iterate', 'mine', 'modernize', 'package', 'pilot', 'quantify', 'refactor',
  'secure', 'simulate', 'standardize', 'synthesize', 'tune', 'upgrade', 'architect', 'detect',
  'predict', 'segment', 'label', 'annotate', 'query', 'aggregate', 'transform', 'consolidate',
];

const NOUNISH = new Set([
  'model', 'process', 'test', 'report', 'support', 'research', 'document', 'label', 'query',
  'package', 'forecast', 'experiment', 'map', 'plan', 'work', 'help', 'guide', 'secure',
  'segment', 'review', 'track', 'benchmark', 'pilot', 'engineer', 'architect', 'clean', 'mine',
  'tune', 'train', 'present', 'set', 'run', 'lead', 'control', 'design', 'scale', 'measure',
  'monitor', 'transform', 'aggregate', 'shape', 'craft', 'serve', 'own', 'record', 'deliver',
]);

function regularPast(base) {
  if (/e$/.test(base)) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  return `${base}ed`;
}

function gerunds(base) {
  const forms = [`${base}ing`];
  if (/[^e]e$/.test(base)) forms.push(`${base.slice(0, -1)}ing`);
  if (/^(?:plan|ship|map|commit|control|run|set|put|scan)$/.test(base)) forms.push(`${base}${base.slice(-1)}ing`);
  return forms;
}

// Every verb form ("design", "designs", "designing") -> past tense.
const PAST = new Map();
for (const base of [...new Set([...REGULAR, ...Object.keys(IRREGULAR)])]) {
  const past = IRREGULAR[base] || regularPast(base);
  const forms = [base, `${base}s`, `${base}es`, past, ...gerunds(base)];
  if (/[^aeiou]y$/.test(base)) forms.push(`${base.slice(0, -1)}ies`);
  for (const form of forms) PAST.set(form, past);
}

const LEAD_IN_RE = /^(?:(?:in\s+this\s+role,?\s+)?(?:you(?:'|’)ll|you\s+will|you\s+are\s+going\s+to|the\s+(?:ideal\s+)?candidate\s+will|candidate\s+will|will)(?:\s+be)?(?:\s+responsible\s+for)?|(?:be\s+)?responsible\s+for|responsibilities\s+include|ability\s+to|be\s+able\s+to|able\s+to|help\s+us|help)\s+/i;
const NOISE_RE = /\b(?:resume|cv|rate|rates|visa|c2c|w2|1099|h-?1b|green\s*card|gc|citizen(?:ship)?|contact|e-?mail|phone|call|apply|reply|respond|linkedin|interview|salary|compensation|benefits?|pto|401k|equal\s+opportunity|years?\s+of|degree|bachelor|master'?s|phd|relocat\w*|travel|sponsor\w*|onsite|hybrid|remote|location|duration|(?:our|end|direct)\s+client|vendor|recruit\w*|hiring|urgent|immediate|asap)\b/i;
const RESP_HEADING_RE = /^(?:key\s+|core\s+|primary\s+|main\s+)?(?:responsibilities|duties|job\s+duties|what\s+you(?:'|’)?ll\s+(?:do|be\s+doing)|what\s+you\s+will\s+do|the\s+role|role\s+(?:description|overview)|day[ -]to[ -]day|in\s+this\s+role|your\s+impact|the\s+work)\b/i;
const OTHER_HEADING_RE = /^(?:requirements|required|qualifications|minimum|basic|preferred|nice[ -]to[ -]have|bonus|skills|about\s+(?:you|us|the\s+company)|who\s+you\s+are|what\s+you(?:'|’)?ll\s+need|what\s+we(?:'|’)?re\s+looking\s+for|benefits|perks|compensation|why\s+join)\b/i;

const TERMS = TAXONOMY.filter((term) => term.score !== false);

function keywordHits(text) {
  let hits = 0;
  for (const term of TERMS) if (countTerm(text, term) > 0) hits += 1;
  return hits;
}

function toPastTense(line) {
  const words = line.split(/\s+/);
  let expectVerb = true;
  let converted = 0;
  for (let i = 0; i < words.length; i += 1) {
    const raw = words[i];
    const match = /^([A-Za-z-]+)([,;]?)$/.exec(raw);
    const lower = match ? match[1].toLowerCase() : '';
    if (expectVerb && match && PAST.has(lower)) {
      words[i] = `${PAST.get(lower)}${match[2]}`;
      converted += 1;
      expectVerb = match[2] === ',';
      continue;
    }
    if (converted && /^(?:and|&|or|\/)$/i.test(raw)) {
      expectVerb = true;
      continue;
    }
    break;
  }
  if (!converted) return '';
  // A later "… and establish X" clause keeps the tense consistent. Words that
  // are usually nouns after "and" ("data and model performance") are skipped.
  const text = words.join(' ').replace(/(\s(?:and|&)\s)([a-z-]+)\b/g, (match, joiner, word) => {
    if (!PAST.has(word)) return match;
    const gerund = /ing$/.test(word);
    const base = gerund ? word.replace(/ing$/, '') : word;
    if (NOUNISH.has(base) || NOUNISH.has(`${base}e`)) return match;
    if (!gerund && /(?:s|ed)$/.test(word)) return match;
    return `${joiner}${PAST.get(word)}`;
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanLine(raw) {
  let line = normalizeText(String(raw || '')
    .replace(/^\s*(?:[-•*▪●◦–]|\d+[.)])\s*/, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1'));
  for (let i = 0; i < 2; i += 1) line = line.replace(LEAD_IN_RE, '');
  line = line
    .replace(/\b(?:our|your|their)\b/gi, 'the')
    .replace(/[.;:,!\s]+$/, '');
  return line;
}

function wordSet(text) {
  return new Set(normalizeText(text).toLowerCase().replace(/\*\*/g, '').split(/[^a-z0-9+#]+/).filter((w) => w.length > 3));
}

function overlaps(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size) >= 0.6;
}

/**
 * @param {string} jd
 * @param {{existing?: string[], limit?: number}} opts
 * @returns {string[]} up to `limit` past-tense bullets, most JD-relevant first
 */
export function responsibilityBullets(jd = '', { existing = [], limit = 3 } = {}) {
  const candidates = [];
  let inResponsibilities = false;
  String(jd || '').split(/\r?\n/).forEach((rawLine, index) => {
    const heading = rawLine.trim().replace(/[:\s]+$/, '');
    if (heading.length <= 60 && RESP_HEADING_RE.test(heading)) {
      inResponsibilities = true;
      return;
    }
    if (heading.length <= 60 && OTHER_HEADING_RE.test(heading)) {
      inResponsibilities = false;
      return;
    }
    const line = cleanLine(rawLine);
    if (line.length < 35 || line.length > 230) return;
    if (NOISE_RE.test(rawLine)) return;
    if (/\b(?:we|you|us|i)\b/i.test(line)) return;
    const bullet = toPastTense(line);
    if (!bullet) return;
    const score = keywordHits(bullet) + (inResponsibilities ? 2 : 0);
    candidates.push({ bullet: `${bullet}.`, score, index });
  });

  const picked = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (picked.length >= limit) break;
    if ([...existing, ...picked].some((other) => overlaps(other, candidate.bullet))) continue;
    picked.push(candidate.bullet);
  }
  return picked;
}
