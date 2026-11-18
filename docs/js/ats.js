import {
  ACTION_VERBS,
  DEGREE_PATTERNS,
  ROLE_TITLES,
  TAXONOMY,
} from './taxonomy.js';
import { normalizeText, unique } from './util.js';

const SECTION_RE = /^(?:required|requirements|must[ -]?have|minimum qualifications|basic qualifications|what you(?:'|’)?ll need|qualifications|preferred|preferred qualifications|nice[ -]?to[ -]?have|bonus points|bonus|about the role|the role|responsibilities|what you(?:'|’)?ll do)\b/i;

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'is',
  'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was', 'were', 'will',
  'with', 'you', 'your', 'we', 'our', 'us', 'they', 'them', 'who', 'what', 'when', 'where',
  'how', 'all', 'any', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'not', 'but',
  'if', 'into', 'over', 'under', 'about', 'across', 'within', 'using', 'use', 'used', 'work',
  'working', 'role', 'job', 'team', 'teams', 'company', 'years', 'year', 'experience', 'strong',
  'excellent', 'good', 'great', 'plus', 'etc', 'including', 'include', 'includes', 'required',
  'preferred', 'ability', 'skills', 'skill', 'knowledge', 'understanding', 'familiarity',
  'proficiency', 'proficient', 'hands', 'hand', 'on', 'new', 'other', 'more', 'most', 'well',
  'also', 'help', 'build', 'building', 'develop', 'developing', 'deliver', 'delivering',
]);

export function normalizeForMatch(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasRegex(alias) {
  // Lookarounds keep repeated terms countable without eating the separator.
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(alias)}(?![A-Za-z0-9])`, 'g');
}

export function countTerm(text = '', term = {}) {
  const original = String(text);
  const normalized = normalizeForMatch(original);
  const rawAliases = unique([term.name, ...(term.aliases || [])].filter(Boolean));
  const aliases = term.short
    ? rawAliases.filter((a) => a === term.name || a.length > 2)
    : rawAliases.map(normalizeForMatch);
  let count = 0;
  for (const alias of aliases) {
    if (!alias) continue;
    const short = Boolean(term.short);
    const source = short ? original : normalized;
    const re = aliasRegex(short ? alias : normalizeForMatch(alias), short);
    const matches = source.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

export function termInText(text = '', term = {}) {
  return countTerm(text, term) > 0;
}

export function resumeToText(master = {}) {
  const parts = [];
  const p = master.profile || {};
  parts.push(p.name, p.phone, p.email, ...(p.links || []).map((l) => l.label));
  parts.push(master.summary);
  for (const role of master.experience || []) {
    parts.push(role.title, role.company, role.dates, ...(role.bullets || []));
  }
  for (const project of master.projects || []) {
    parts.push(project.name, project.tech, ...(project.bullets || []));
  }
  for (const group of master.skills || []) {
    parts.push(group.label, ...(group.items || []));
  }
  const edu = master.education || {};
  parts.push(edu.school, edu.degree, edu.coursework);
  for (const cert of master.certifications || []) {
    parts.push(cert.org, cert.items);
  }
  return normalizeText(parts.filter(Boolean).join(' \n '));
}

export function splitJdSections(jd = '') {
  const lines = String(jd).split(/\r?\n/);
  const sections = [{ name: 'overview', text: '' }];
  let current = sections[0];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      current.text += '\n';
      continue;
    }
    if (trimmed.length <= 90 && SECTION_RE.test(trimmed)) {
      const name = /preferred|nice|bonus/i.test(trimmed)
        ? 'preferred'
        : /required|must|minimum|basic|qualification/i.test(trimmed)
          ? 'required'
          : 'overview';
      current = { name, text: '' };
      sections.push(current);
      continue;
    }
    current.text += `${trimmed}\n`;
  }
  return sections;
}

function sectionWeightForTerm(sections, term) {
  let best = { name: 'overview', weight: 1 };
  for (const section of sections) {
    if (countTerm(section.text, term) > 0) {
      const weight = section.name === 'required' ? 1.25 : section.name === 'preferred' ? 1.08 : 1;
      if (weight > best.weight) best = { name: section.name, weight };
    }
  }
  return best;
}

const GENERIC_HEADING_RE = /^(?:title\s*:|url\s+source|markdown\s+content|published\s+time|back\s+to\s+(?:all\s+)?jobs?|view\s+(?:all\s+)?jobs?|apply(?:\s+now)?|save\s+(?:this\s+)?job|create\s+(?:a\s+)?job\s+alert|about(?:\s+the)?(?:\s+(?:team|role|us|company|position|job|opportunity))?|the\s+(?:team|role|company|opportunity)|overview|summary|responsibilities|key\s+responsibilities|what\s+you(?:'|’)?ll\s+(?:do|need|be\s+doing)|what\s+we(?:'|’)?re\s+looking\s+for|who\s+you\s+are|requirements|qualifications|preferred(?:\s+qualifications)?|minimum\s+qualifications|basic\s+qualifications|benefits|perks|compensation|salary|pay\s+range|location|department|job\s+description|job\s+type|employment\s+type|in\s+this\s+(?:role|position)|you\s+(?:will|might|may|should)|day[ -]to[ -]day|reports?\s+to|why\s+(?:join|openai|us)|equal\s+opportunity)(?=\s|:|$)/i;

function looksLikeTitle(line = '') {
  const value = String(line || '').trim();
  if (!value || value.length > 90) return false;
  if (/[.!?;:]$/.test(value)) return false;
  if (/^(?:we|you|our|this|that|these|those|it|they|i)\b/i.test(value)) return false;
  return value.split(/\s+/).filter(Boolean).length <= 7;
}

export function extractJobTitle(jd = '') {
  const text = String(jd).trim();
  if (!text) return '';
  const explicit = text.match(/(?:job title|position|role)\s*[:\-–—]\s*([^\n]{3,90})/i);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-•](?=\s)|\*(?=\s)|\d+\.(?=\s))\s*/, '')
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .trim())
    .filter(Boolean);
  const titleLines = lines.slice(0, 80).filter((line) => line.length <= 100 && !GENERIC_HEADING_RE.test(line));
  const known = titleLines.find((line) => {
    const lower = line.toLowerCase();
    return looksLikeTitle(line) && ROLE_TITLES.some((t) => lower.startsWith(t));
  });
  const fallback = titleLines.find(looksLikeTitle) || '';
  let title = explicit?.[1] || known || fallback;
  title = title
    .replace(/^(?:job title|position|role)\s*[:\-–—]\s*/i, '')
    .split(/[|•]/)[0]
    .replace(/\s*[—–-]\s*(?:remote|hybrid|onsite|on-site|contract|full[ -]time|part[ -]time).*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  return title.slice(0, 90);
}

export function extractYears(jd = '') {
  const text = String(jd);
  const range = text.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  if (range) return Number(range[1]);
  const single = text.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  return single ? Number(single[1]) : null;
}

export function extractDegree(jd = '') {
  const text = String(jd);
  for (const item of DEGREE_PATTERNS) {
    if (item.re.test(text)) return item.label;
  }
  return '';
}

function titleFamily(title = '') {
  const value = String(title).toLowerCase();
  const ordered = [...ROLE_TITLES].sort((a, b) => b.length - a.length);
  const found = ordered.find((t) => value.includes(t));
  if (!found) return '';
  if (/machine learning|ml engineer|ai engineer|applied scientist|research scientist|data science/.test(found)) {
    return 'data-science';
  }
  if (/business intelligence|bi analyst|data analyst|product analyst|business analyst/.test(found)) {
    return 'analytics';
  }
  if (/data engineer|analytics engineer/.test(found)) {
    return 'data-engineering';
  }
  if (/decision scientist|quantitative analyst/.test(found)) {
    return 'data-science';
  }
  return found;
}

export function titleMatchScore(jdTitle = '', master = {}) {
  const family = titleFamily(jdTitle);
  const masterTitles = [
    ...(master.experience || []).map((r) => r.title || ''),
    master.summary || '',
  ].join(' ').toLowerCase();
  if (!jdTitle) return { score: 0.5, family: '', detail: 'No clear job title in the description.' };
  if (!family) {
    const tokens = normalizeForMatch(jdTitle).split(' ').filter((t) => t.length > 2 && !STOPWORDS.has(t));
    const hits = tokens.filter((t) => masterTitles.includes(t));
    const score = hits.length ? 0.65 : 0.4;
    return {
      score,
      family: '',
      detail: hits.length
        ? `Title wording overlaps on ${hits.slice(0, 4).join(', ')}.`
        : 'The job title is not a close match to the resume titles.',
    };
  }
  const same = masterTitles.includes(family.replace('-', ' '))
    || (family === 'data-science' && /data scientist|machine learning|software engineer/.test(masterTitles))
    || (family === 'analytics' && /data analyst|business intelligence|analytics/.test(masterTitles))
    || (family === 'data-engineering' && /data engineer|software engineer/.test(masterTitles));
  return {
    score: same ? 1 : 0.6,
    family,
    detail: same
      ? 'The target title is supported by your existing job titles and summary.'
      : 'The target title is adjacent to your experience; keep the summary honest and specific.',
  };
}

function buildChecks(master = {}, resumeText = '') {
  const roles = master.experience || [];
  const projects = master.projects || [];
  const skills = master.skills || [];
  const allBullets = [
    ...roles.flatMap((r) => r.bullets || []),
    ...projects.flatMap((p) => p.bullets || []),
  ];
  const quantified = allBullets.filter((b) => /\d/.test(b)).length;
  const actionStarts = (master.experience || []).flatMap((r) => r.bullets || [])
    .filter((b) => {
      const first = normalizeText(b).split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
      return ACTION_VERBS.includes(first);
    }).length;
  const experienceBullets = (master.experience || []).reduce((n, r) => n + (r.bullets || []).length, 0);
  const checks = [
    {
      id: 'contact',
      label: 'Contact details',
      weight: 4,
      pass: Boolean(master.profile?.phone && master.profile?.email),
      detail: master.profile?.phone && master.profile?.email
        ? 'Phone and email are present in the document body.'
        : 'Add both a phone number and an email address.',
    },
    {
      id: 'headings',
      label: 'Standard section headings',
      weight: 4,
      pass: Boolean(master.summary && roles.length && skills.length && master.education?.school),
      detail: 'Uses conventional headings: Professional Summary, Work Experience, Projects, Technical Skills, Education.',
    },
    {
      id: 'dates',
      label: 'Dates on every role',
      weight: 3,
      pass: roles.length > 0 && roles.every((r) => Boolean(r.dates)),
      detail: 'Recruiters and parsers can calculate recency from each role.',
    },
    {
      id: 'bullets',
      label: 'Bulleted achievements',
      weight: 3,
      pass: roles.every((r) => (r.bullets || []).length >= 2) && projects.every((p) => (p.bullets || []).length >= 1),
      detail: 'Each role and project uses short bullet points rather than paragraphs.',
    },
    {
      id: 'quantified',
      label: 'Quantified impact',
      weight: 3,
      pass: quantified >= 4,
      detail: `${quantified} bullets include numbers or percentages.`,
    },
    {
      id: 'skills',
      label: 'Dedicated skills section',
      weight: 3,
      pass: skills.length >= 4 && skills.some((g) => (g.items || []).length),
      detail: 'Keywords are grouped by category so both people and parsers can scan them.',
    },
    {
      id: 'links',
      label: 'Professional links',
      weight: 2,
      pass: (master.profile?.links || []).length > 0,
      detail: 'LinkedIn, GitHub, or a portfolio is included as readable text.',
    },
    {
      id: 'verbs',
      label: 'Strong action verbs',
      weight: 3,
      pass: experienceBullets === 0 || actionStarts / experienceBullets >= 0.6,
      detail: `${actionStarts} of ${experienceBullets} experience bullets start with an action verb.`,
    },
    {
      id: 'layout',
      label: 'Single-column, parser-safe layout',
      weight: 3,
      pass: true,
      detail: 'No tables, text boxes, images, columns, headers, or footers are used.',
    },
  ];
  return checks;
}

export function analyzeJd(jd = '') {
  const sections = splitJdSections(jd);
  const title = extractJobTitle(jd);
  const years = extractYears(jd);
  const degree = extractDegree(jd);
  const titleFamilyValue = titleFamily(title);
  const keywords = [];

  for (const term of TAXONOMY) {
    const count = countTerm(jd, term);
    if (!count) continue;
    const section = sectionWeightForTerm(sections, term);
    const titleBoost = title && countTerm(title, term) > 0 ? 1.3 : 1;
    const frequency = 1 + Math.min(0.9, Math.log2(count + 1) * 0.3);
    const coreBoost = term.core ? 1.12 : 1;
    keywords.push({
      name: term.name,
      category: term.category,
      count,
      weight: Number((frequency * section.weight * titleBoost * coreBoost).toFixed(3)),
      required: section.name === 'required',
      preferred: section.name === 'preferred',
      score: term.score !== false,
      core: Boolean(term.core),
    });
  }

  keywords.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
  return { title, years, degree, titleFamily: titleFamilyValue, keywords, sections };
}

export function buildAtsReport(master = {}, jd = '', opts = {}) {
  const base = analyzeJd(jd);
  const resumeText = opts.resumeText || resumeToText(master);
  const keywords = base.keywords.map((k) => {
    const term = TAXONOMY.find((t) => t.name === k.name) || k;
    return { ...k, matched: countTerm(resumeText, term) > 0 };
  });
  const scored = keywords.filter((k) => k.score);
  const totalWeight = scored.reduce((n, k) => n + k.weight, 0);
  const matchedWeight = scored.filter((k) => k.matched).reduce((n, k) => n + k.weight, 0);
  const keywordScore = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  const title = titleMatchScore(base.title, master);
  const checks = buildChecks(master, resumeText);
  const checkWeight = checks.reduce((n, c) => n + c.weight, 0);
  const checkPass = checks.filter((c) => c.pass).reduce((n, c) => n + c.weight, 0);
  const formatScore = checkWeight ? Math.round((checkPass / checkWeight) * 100) : 0;
  const score = Math.round(keywordScore * 0.65 + title.score * 100 * 0.10 + formatScore * 0.25);
  const matched = keywords.filter((k) => k.matched);
  const missing = keywords.filter((k) => !k.matched);
  const confidence = scored.length >= 14 ? 'high' : scored.length >= 7 ? 'medium' : 'low';
  return {
    ...base,
    keywords,
    matched,
    missing,
    keywordScore,
    titleScore: Math.round(title.score * 100),
    titleDetail: title.detail,
    formatScore,
    checks,
    score,
    confidence,
    totalKeywords: scored.length,
    matchedKeywords: matched.filter((k) => k.score).length,
    resumeText,
  };
}

export function keywordCoverage(report) {
  return report.keywordScore;
}

export function topMatched(report, limit = 8, scoreOnly = true) {
  return report.matched
    .filter((k) => !scoreOnly || k.score)
    .slice(0, limit);
}

export function topMissing(report, limit = 12) {
  return report.missing
    .filter((k) => k.score)
    .slice(0, limit);
}

export function keywordNames(report) {
  return report.keywords.map((k) => k.name);
}

/**
 * Extract a few "other" JD terms that are not in the taxonomy. These are
 * shown as review items, never auto-added to the resume.
 */
export function extractUnknownTerms(jd = '', resumeText = '') {
  const text = String(jd);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-•*]/.test(l));
  const candidates = [];
  for (const line of lines) {
    const clean = line.replace(/^[-•*]\s*/, '');
    for (const chunk of clean.split(/[,;|]/)) {
      const value = chunk
        .replace(/\([^)]*\)/g, '')
        .replace(/\b(?:experience|knowledge|familiarity|proficiency|with|in|using|of|and|or)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (value.length < 3 || value.length > 40) continue;
      if (!/[A-Z]/.test(value)) continue;
      if (TAXONOMY.some((t) => countTerm(value, t) > 0)) continue;
      if (countTerm(resumeText, { name: value, aliases: [] }) > 0) continue;
      candidates.push(value);
    }
  }
  return unique(candidates).slice(0, 8);
}
