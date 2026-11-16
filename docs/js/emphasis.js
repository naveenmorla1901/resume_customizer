import { TAXONOMY } from './taxonomy.js';
import { countTerm } from './ats.js';

const BOLD_RE = /\*\*([^*\n]+)\*\*/g;
const MAX_BOLD_PER_BULLET = 3;

function splitBold(text = '') {
  const value = String(text || '');
  const segments = [];
  let last = 0;
  let match;
  BOLD_RE.lastIndex = 0;
  while ((match = BOLD_RE.exec(value))) {
    if (match.index > last) {
      segments.push({ text: value.slice(last, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < value.length) {
    segments.push({ text: value.slice(last), bold: false });
  }
  return segments;
}

function joinSegments(segments = []) {
  return segments.map((segment) => (segment.bold ? `**${segment.text}**` : segment.text)).join('');
}

function countBold(text = '') {
  return splitBold(text).filter((segment) => segment.bold).length;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayAliases(term) {
  return [...new Set([term.name, ...(term.aliases || [])].filter(Boolean))]
    // Short aliases such as "r", "ml", and "go" create too much noise in a
    // resume. Keep the explicit tool names bold instead.
    .filter((alias) => String(alias).length >= 3)
    .sort((a, b) => String(b).length - String(a).length);
}

function termRegex(term) {
  const aliases = displayAliases(term).map(escapeRegExp);
  if (!aliases.length) return null;
  return new RegExp(`(?<![A-Za-z0-9])(${aliases.join('|')})(?![A-Za-z0-9])`, 'i');
}

function boldFirstOutsideBold(text, regex) {
  const segments = splitBold(text);
  for (const segment of segments) {
    if (segment.bold) continue;
    const match = regex.exec(segment.text);
    if (!match) continue;
    segment.text = `${segment.text.slice(0, match.index)}**${match[0]}**${segment.text.slice(match.index + match[0].length)}`;
    return joinSegments(segments);
  }
  return text;
}

function rankedTerms(keywords = []) {
  const byName = new Map(TAXONOMY.map((term) => [term.name, term]));
  return keywords
    .filter((keyword) => keyword.matched && keyword.score !== false && Number(keyword.weight) > 0)
    .map((keyword) => ({ term: byName.get(keyword.name), weight: Number(keyword.weight) || 0 }))
    .filter(({ term }) => term && !term.short && term.name.length >= 3)
    .sort((a, b) => b.weight - a.weight)
    .map(({ term }) => term);
}

/**
 * Add bold around the highest-value JD terms that are already in a bullet.
 * Existing bold is preserved, and the pass stops at three bold spans so the
 * resume stays easy to scan instead of turning into a wall of emphasis.
 */
export function emphasizeBullets(bullets = [], keywords = [], maxBold = MAX_BOLD_PER_BULLET) {
  const terms = rankedTerms(keywords)
    .map((term) => ({ term, regex: termRegex(term) }))
    .filter(({ regex }) => Boolean(regex));
  if (!terms.length) return bullets;

  return bullets.map((bullet) => {
    let value = String(bullet || '');
    let boldCount = countBold(value);
    if (boldCount >= maxBold) return value;

    const plain = splitBold(value).map((segment) => segment.text).join(' ');
    for (const { term, regex } of terms) {
      if (boldCount >= maxBold) break;
      if (!countTerm(plain, term)) continue;
      const next = boldFirstOutsideBold(value, regex);
      if (next !== value) {
        value = next;
        boldCount += 1;
      }
    }
    return value;
  });
}

export function emphasizePlan(plan = {}, report = null) {
  const keywords = report?.keywords || [];
  if (!keywords.length || !Array.isArray(plan.experience)) return plan;
  return {
    ...plan,
    experience: plan.experience.map((role) => ({
      ...role,
      bullets: emphasizeBullets(role.bullets || [], keywords),
    })),
  };
}
