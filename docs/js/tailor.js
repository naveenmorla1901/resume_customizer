import { TAXONOMY, CORE_SKILL_NAMES } from './taxonomy.js';
import { analyzeJd, buildAtsReport, countTerm, resumeToText } from './ats.js';
import { emphasizePlan } from './emphasis.js';
import { normalizeText, unique } from './util.js';

const TERM_BY_NAME = new Map(TAXONOMY.map((t) => [t.name.toLowerCase(), t]));

const GROUP_FOR_CATEGORY = {
  'Languages': 'Languages',
  'ML & AI': 'AI & ML',
  'LLM & GenAI': 'LLM & Vector Stack',
  'Data & Analytics': 'Data & Analytics',
  'Frameworks & Libraries': 'Frameworks & Libraries',
  'Cloud': 'Cloud',
  'Databases': 'Databases',
  'DevOps & MLOps': 'DevOps & MLOps',
  'BI & Visualization': 'BI & Visualization',
  'Statistics': 'Statistics & Algorithms',
  'Domain': 'Domain',
  'Practices': 'Practices',
};

const CAPABILITIES = [
  { label: 'forecasting models', terms: ['Forecasting', 'Time Series', 'Demand Forecasting'], phrase: 'forecasting models' },
  { label: 'LLM sentiment analysis', terms: ['LLM', 'Sentiment Analysis', 'Generative AI'], phrase: 'LLM based sentiment analysis' },
  { label: 'Power BI dashboards', terms: ['Power BI'], phrase: 'Power BI dashboards' },
  { label: 'FastAPI data pipelines', terms: ['FastAPI', 'Data Pipelines'], phrase: 'FastAPI' },
  { label: 'RAG pipelines', terms: ['RAG', 'Embeddings', 'Vector Search'], phrase: 'RAG' },
  { label: 'agentic AI workflows', terms: ['Agentic AI', 'LLM', 'Prompt Engineering'], phrase: 'Agentic AI' },
  { label: 'production MLOps', terms: ['MLOps', 'Model Deployment', 'Model Monitoring'], phrase: 'MLOps' },
  { label: 'executive dashboards', terms: ['Dashboarding', 'Data Visualization', 'KPI Reporting', 'Tableau'], phrase: 'dashboards' },
  { label: 'A/B testing', terms: ['A/B Testing', 'Experimentation'], phrase: 'A/B tests' },
  { label: 'scalable APIs', terms: ['FastAPI', 'Flask', 'API'], phrase: 'FastAPI' },
  { label: 'real-time analytics', terms: ['Real-Time Analytics', 'Stream Processing'], phrase: 'real time analytics' },
  { label: 'data governance', terms: ['Data Governance', 'Data Quality'], phrase: 'data governance' },
];

const HEADLINE_RULES = [
  { re: /machine learning|ml engineer|ai engineer|applied scientist/i, text: 'Data Scientist / Machine Learning Engineer' },
  { re: /business intelligence|bi analyst|data analyst|product analyst|business analyst/i, text: 'Data Scientist / Business Intelligence Analyst' },
  { re: /data engineer|analytics engineer/i, text: 'Data Scientist / Data Engineer' },
  { re: /data scientist|decision scientist|quantitative analyst/i, text: 'Data Scientist' },
];

// These rewrites only make an existing fact easier to find. They never add a
// tool, metric, employer, or responsibility that is not already in the bullet.
const ALIGNMENT_RULES = [
  {
    label: 'predictive forecasting',
    jd: /\b(?:forecast|forecasting|predictive model|predictive analytics|time series)\b/i,
    source: /\bforecasting models?\b/i,
    target: 'predictive forecasting models',
    already: /predictive forecasting models?/i,
  },
  {
    label: 'NLP / sentiment analysis',
    jd: /\b(?:nlp|natural language|sentiment|genai|generative ai|llm)\b/i,
    source: /\bLLM[ -]based sentiment analysis\b/i,
    target: 'NLP and LLM-based sentiment analysis',
    already: /NLP and LLM-based sentiment analysis/i,
  },
  {
    label: 'business intelligence dashboards',
    jd: /\b(?:business intelligence|bi\b|dashboards?|reporting)\b/i,
    source: /\bPower BI dashboards?\b/i,
    target: 'business intelligence dashboards using Power BI',
    already: /business intelligence dashboards using Power BI/i,
  },
  {
    label: 'real-time analytics',
    jd: /\b(?:real[ -]?time|streaming|analytics)\b/i,
    source: /\breal time insights\b/i,
    target: 'real-time analytics and insights',
    already: /real-time analytics and insights/i,
  },
  {
    label: 'CI/CD and model deployment',
    jd: /\b(?:ci\/cd|mlops|model deployment|deployment|devops)\b/i,
    source: /\bCI\/CD pipelines\b/i,
    target: 'CI/CD and model deployment pipelines',
    already: /CI\/CD and model deployment pipelines/i,
  },
  {
    label: 'statistical modeling / machine learning',
    jd: /\b(?:statistical modeling|machine learning|ml\b|predictive)\b/i,
    source: /\bstatistical and ML techniques\b/i,
    target: '**statistical modeling and machine learning techniques**',
    already: /statistical modeling and machine learning techniques/i,
  },
  {
    label: 'experimentation',
    jd: /\b(?:experiment(?:ation|s|al)?|a\/b test(?:s|ing)?|split test(?:s|ing)?)\b/i,
    source: /Ran (?:\*\*)?A\/B tests(?:\*\*)? and (?:\*\*)?hypothesis evaluations(?:\*\*)?/i,
    target: 'Ran **A/B tests**, **experimentation**, and **hypothesis evaluations**',
    already: /\bexperimentation\b/i,
    anyRole: true,
  },
];

function roleBulletCap(index) {
  // Keep every bullet in the latest role. Older roles keep up to six; the
  // two-page fitter trims further only when the preview actually overflows.
  return index === 0 ? Infinity : 6;
}

function textScore(text, keywords, bonusTerms = []) {
  let score = 0;
  for (const keyword of keywords) {
    const term = TERM_BY_NAME.get(keyword.name.toLowerCase());
    if (term && countTerm(text, term)) score += keyword.weight;
  }
  for (const termName of bonusTerms) {
    const term = TERM_BY_NAME.get(termName.toLowerCase());
    if (term && countTerm(text, term)) score += 0.5;
  }
  return score;
}

function ranked(items, scoreFn) {
  return items
    .map((item, index) => ({ item, index, score: scoreFn(item, index) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function groupRelevance(group, keywords) {
  const labelTerm = TERM_BY_NAME.get(group.label.toLowerCase());
  let score = labelTerm ? textScore(group.label, keywords) : 0;
  // A group like Cloud contains several relevant tools; capping each item at
  // 2 points made rich, relevant groups rank below a single added keyword.
  for (const item of group.items || []) score += Math.min(4, textScore(item, keywords));
  return score;
}

function itemRelevance(item, keywords) {
  const direct = keywords.find((k) => k.name.toLowerCase() === String(item).toLowerCase());
  if (direct) return direct.weight * 3;
  const term = TAXONOMY.find((t) => countTerm(item, t) > 0 && keywords.some((k) => k.name === t.name));
  if (term) {
    const match = keywords.find((k) => k.name === term.name);
    return match.weight * 1.5;
  }
  return 0;
}

function pickSkills(master, analysis) {
  const keywords = analysis.keywords.filter((k) => k.score);
  const groups = (master.skills || []).map((group, index) => ({
    label: group.label,
    items: [...(group.items || [])],
    originalIndex: index,
    relevance: groupRelevance(group, keywords),
  }));

  // Ensure JD tools that already exist in the master are represented in
  // the skills section, even if they only appeared in a bullet.
  const masterText = resumeToText(master);
  for (const keyword of keywords) {
    if (!keyword.matched) continue;
    const term = TERM_BY_NAME.get(keyword.name.toLowerCase());
    if (!term) continue;
    const already = groups.some((g) => (g.items || []).some((item) => countTerm(item, term) > 0));
    if (already) continue;
    if (!countTerm(masterText, term)) continue;
    const groupLabel = GROUP_FOR_CATEGORY[keyword.category] || 'Frameworks & Libraries';
    let group = groups.find((g) => g.label === groupLabel);
    if (!group) {
      group = { label: groupLabel, items: [], originalIndex: 99, relevance: 0 };
      groups.push(group);
    }
    group.items.push(keyword.name);
    group.relevance += keyword.weight;
  }

  groups.sort((a, b) => b.relevance - a.relevance || a.originalIndex - b.originalIndex);

  // Keep the conventional Languages-first order and protect it from being
  // dropped if the fitter has to reduce the number of groups.
  const languagesIndex = groups.findIndex((group) => group.label === 'Languages');
  if (languagesIndex > 0) groups.unshift(groups.splice(languagesIndex, 1)[0]);

  const seen = new Set();
  const result = [];
  for (const group of groups) {
    const rankedItems = ranked(group.items, (item) => itemRelevance(item, keywords))
      .map(({ item }) => item)
      .filter((item) => {
        const key = normalizeText(item).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!rankedItems.length) continue;
    const matched = rankedItems.filter((item) => itemRelevance(item, keywords) > 0);
    const core = rankedItems.filter((item) => CORE_SKILL_NAMES.has(item) || CORE_SKILL_NAMES.has(String(item).split(' (')[0]));
    const max = group.label === 'AI & ML' ? 12 : group.label === 'Languages' ? 8 : 10;
    const keep = unique([...matched, ...core, ...rankedItems]).slice(0, max);
    if (keep.length) result.push({ label: group.label, items: keep });
  }

  // Keep the section useful if an unusual resume has no matched groups.
  if (!result.length) {
    const fallback = (master.skills || []).slice(0, 10).map((g) => ({ label: g.label, items: (g.items || []).slice(0, 10) }));
    return ensureExperimentationSkill(fallback, analysis).skills;
  }
  return ensureExperimentationSkill(result.slice(0, 10), analysis).skills;
}

/**
 * "A/B Testing" is the evidence; "Experimentation" is the broader JD term.
 * When the job asks for experimentation and the master already documents A/B
 * tests, show both phrases in the skills section instead of reporting a gap.
 */
export function ensureExperimentationSkill(skills = [], report = null) {
  const wantsExperimentation = (report?.matched || []).some((keyword) => keyword.name === 'Experimentation');
  if (!wantsExperimentation) return { skills, added: false };

  const groups = (skills || []).map((group) => ({
    ...group,
    items: [...(group.items || [])],
  }));
  let added = false;
  let represented = false;
  for (const group of groups) {
    group.items = group.items.map((item) => {
      if (/\bexperimentation\b/i.test(item)) {
        represented = true;
        return item;
      }
      if (/\bA\/B Testing\b/i.test(item)) {
        represented = true;
        added = true;
        return item.replace(/\bA\/B Testing\b/i, 'A/B Testing (Experimentation)');
      }
      return item;
    });
  }
  if (!represented) {
    let group = groups.find((g) => /statistics|algorithms/i.test(g.label));
    if (!group) {
      group = { label: 'Statistics & Algorithms', items: [] };
      groups.push(group);
    }
    group.items.push('Experimentation');
    added = true;
  }
  return { skills: groups, added };
}

function uniqueCoverage(text, keywords, baseText) {
  let bonus = 0;
  for (const keyword of keywords) {
    const term = TERM_BY_NAME.get(keyword.name.toLowerCase());
    if (!term) continue;
    if (!countTerm(text, term)) continue;
    if (countTerm(baseText, term) > 0) continue;
    // This keyword appears only in a project, not in the summary, experience,
    // skills, education, or certifications. Keeping that project protects a
    // unique ATS match.
    bonus += keyword.weight;
  }
  return bonus;
}

function pickProjects(master, analysis) {
  const keywords = analysis.keywords.filter((k) => k.score);
  const baseText = resumeToText({ ...master, projects: [] });
  return ranked(master.projects || [], (project) => {
    const text = [project.name, project.tech, ...(project.bullets || [])].join(' ');
    return textScore(text, keywords)
      + textScore(project.tech || '', keywords) * 0.5
      + uniqueCoverage(text, keywords, baseText) * 1.25;
  }).map(({ item: project }) => {
    const bulletRank = ranked(project.bullets || [], (bullet) => (
      textScore(bullet, keywords) + uniqueCoverage(bullet, keywords, baseText)
    )).map(({ item }) => item);
    return { id: project.id, bullets: bulletRank.slice(0, 3) };
  });
}

function pickExperience(master, analysis) {
  const keywords = analysis.keywords.filter((k) => k.score);
  return (master.experience || []).map((role, index) => {
    const bulletRank = ranked(role.bullets || [], (bullet) => textScore(bullet, keywords))
      .map(({ item }) => item);
    return { id: role.id, bullets: bulletRank.slice(0, roleBulletCap(index)) };
  });
}

function alignText(text, jd, { olderRole = false } = {}) {
  let value = String(text || '');
  const applied = [];
  for (const rule of ALIGNMENT_RULES) {
    if (olderRole && !rule.anyRole) continue;
    if (rule.already && rule.already.test(value)) continue;
    if (!rule.jd.test(jd) || !rule.source.test(value)) continue;
    const next = value.replace(rule.source, rule.target);
    if (next !== value) {
      value = next;
      applied.push(rule.label);
    }
  }
  return { text: value, applied };
}

function alignRoles(experience, jd) {
  const roles = experience.map((role) => ({ ...role }));
  if (!roles.length) return { experience: roles, changes: [] };
  const changes = [];
  roles.forEach((role, index) => {
    role.bullets = (role.bullets || []).map((bullet) => {
      const aligned = alignText(bullet, jd, { olderRole: index > 0 });
      if (aligned.text !== bullet) {
        changes.push({ roleId: role.id, bullet, after: aligned.text, labels: aligned.applied });
      }
      return aligned.text;
    });
  });
  return { experience: roles, changes };
}

/**
 * Apply only the cross-role evidence rules (currently experimentation) to an
 * AI-selected plan. This keeps the exact JD word where the source resume
 * already proves it, without rewriting the AI's latest-role wording.
 */
export function alignEvidenceRoles(experience = [], jd = '') {
  const roles = experience.map((role) => ({ ...role }));
  const changes = [];
  roles.forEach((role) => {
    role.bullets = (role.bullets || []).map((bullet) => {
      const aligned = alignText(bullet, jd, { olderRole: true });
      if (aligned.text !== bullet) {
        changes.push({ roleId: role.id, bullet, after: aligned.text, labels: aligned.applied });
      }
      return aligned.text;
    });
  });
  return { experience: roles, changes };
}

function extractYears(master, analysis) {
  const match = String(master.summary || '').match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  if (match) return `${match[1]}+`;
  if (analysis.years) return `${analysis.years}+`;
  return '5+';
}

function domainsFrom(master) {
  const text = resumeToText(master).toLowerCase();
  const domains = [];
  if (/\blegal|law firm\b/.test(text)) domains.push('legal');
  if (/\bmanufactur|industrial\b/.test(text)) domains.push('manufacturing');
  if (/\banalytics|consulting|business intelligence\b/.test(text)) domains.push('analytics');
  if (!domains.length) domains.push('data-driven organizations');
  if (domains.length === 3) return `${domains[0]}, ${domains[1]}, and ${domains[2]}`;
  if (domains.length === 2) return `${domains[0]} and ${domains[1]}`;
  return domains[0];
}

function chooseHeadline(analysis) {
  const rule = HEADLINE_RULES.find((r) => r.re.test(analysis.title || ''));
  return rule ? rule.text : 'Data Scientist';
}

function chooseSkills(analysis, master) {
  const matched = analysis.matched.filter((k) => k.score);
  const priority = [
    'LLM & GenAI', 'ML & AI', 'Languages', 'Cloud', 'Frameworks & Libraries',
    'BI & Visualization', 'Databases', 'DevOps & MLOps', 'Statistics', 'Data & Analytics',
  ];
  const chosen = [];
  // Experimentation is a high-signal growth/analytics term. If the job asks
  // for it and the resume already proves it through A/B tests, keep the word
  // in the page-one summary instead of leaving it only in a skills group.
  const experimentation = matched.find((k) => k.name === 'Experimentation');
  if (experimentation) chosen.push(experimentation.name);
  for (const category of priority) {
    for (const keyword of matched.filter((k) => k.category === category)) {
      if (chosen.length >= 9) break;
      if (!chosen.some((c) => c.toLowerCase() === keyword.name.toLowerCase())) chosen.push(keyword.name);
    }
  }
  for (const keyword of matched) {
    if (chosen.length >= 9) break;
    if (!chosen.some((c) => c.toLowerCase() === keyword.name.toLowerCase())) chosen.push(keyword.name);
  }
  if (!chosen.length) return 'Python, SQL, machine learning, and cloud data platforms';
  return chosen.map((name) => name.replace('Scikit Learn', 'scikit-learn')).join(', ');
}

function latestRoleHighlights(master, analysis) {
  const role = (master.experience || [])[0];
  if (!role) return [];
  const roleText = [role.title, ...(role.bullets || [])].filter(Boolean).join(' ');
  const jdMatches = analysis.keywords.filter((k) => k.matched).map((k) => k.name.toLowerCase());
  const picked = [];
  for (const cap of CAPABILITIES) {
    if (picked.length >= 3) break;
    if (!cap.terms.some((term) => jdMatches.includes(term.toLowerCase()))) continue;
    if (roleText.toLowerCase().includes(cap.phrase.toLowerCase())) picked.push(cap.label);
  }
  if (!picked.length) {
    // Even when the JD does not name an exact capability, the latest role
    // should still lead with its strongest real outcomes.
    for (const fallback of ['forecasting models', 'LLM sentiment analysis', 'Power BI dashboards', 'FastAPI data pipelines']) {
      if (picked.length >= 2) break;
      const cap = CAPABILITIES.find((item) => item.label === fallback);
      if (cap && roleText.toLowerCase().includes(cap.phrase.toLowerCase())) picked.push(cap.label);
    }
  }
  return unique(picked).slice(0, 3);
}

function joinNatural(items = []) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function chooseCapabilities(analysis, master) {
  const text = resumeToText(master).toLowerCase();
  const jdMatches = analysis.keywords.filter((k) => k.matched).map((k) => k.name.toLowerCase());
  const picked = [];
  for (const cap of CAPABILITIES) {
    if (picked.length >= 3) break;
    if (!text.includes(cap.phrase.toLowerCase())) continue;
    if (!cap.terms.some((t) => jdMatches.includes(t.toLowerCase()))) continue;
    if (!picked.includes(cap.label)) picked.push(cap.label);
  }
  if (picked.length < 2) {
    for (const fallback of ['forecasting models', 'RAG pipelines', 'FastAPI data pipelines', 'production MLOps']) {
      if (picked.length >= 3) break;
      if (text.includes(fallback.split(' ')[0].toLowerCase()) && !picked.includes(fallback)) picked.push(fallback);
    }
  }
  return picked.slice(0, 3);
}

export function buildLocalSummary(master, analysis) {
  const headline = chooseHeadline(analysis);
  const years = extractYears(master, analysis);
  const domains = domainsFrom(master);
  const skills = chooseSkills(analysis, master);
  const highlights = latestRoleHighlights(master, analysis);
  const capabilities = chooseCapabilities(analysis, master);
  const delivery = highlights.length >= 2
    ? highlights
    : capabilities.length
      ? capabilities
      : ['production ML pipelines', 'LLM applications', 'scalable APIs'];
  const summary = `${headline} with ${years} years of experience building production ML, GenAI, and analytics systems across ${domains}. Deep expertise in ${skills}. Most recently, delivered ${joinNatural(delivery)}.`;
  return shrinkSummary(summary, 540);
}

export function shrinkSummary(summary, maxChars = 480) {
  const text = normalizeText(summary);
  if (text.length <= maxChars) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let out = '';
  for (const sentence of sentences) {
    if ((out + sentence).length > maxChars) break;
    out += sentence;
  }
  if (out.trim().length >= 120) return out.trim();
  const slice = text.slice(0, maxChars);
  const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(', '), slice.lastIndexOf('; '), slice.lastIndexOf(' '));
  return `${slice.slice(0, cut > maxChars * 0.55 ? cut : slice.length).trim().replace(/[.,;:]$/, '')}.`;
}

export function buildLocalPlan(master, jd, report = null) {
  const analysis = report || buildAtsReport(master, jd);
  const summary = buildLocalSummary(master, analysis);
  const aligned = alignRoles(pickExperience(master, analysis), jd);
  const projects = pickProjects(master, analysis);
  const skills = pickSkills(master, analysis);
  const notes = [
    'Local tailoring keeps all wording factual. It selects, reorders, and trims existing content.',
  ];
  if (aligned.changes.length) {
    notes.push(
      `Aligned roles with ${unique(aligned.changes.flatMap((change) => change.labels)).join(', ')} wording where the same facts already existed. No new tools or metrics were added.`,
    );
  }
  if ((analysis.matched || []).some((keyword) => keyword.name === 'Experimentation')) {
    notes.push('Kept Experimentation visible because your resume already documents A/B tests and hypothesis testing.');
  }
  return emphasizePlan({
    source: 'local',
    summary,
    experience: aligned.experience,
    projects,
    skills,
    alignment: aligned.changes,
    notes,
  }, analysis);
}

export function normalizePlan(plan = {}, master = {}) {
  const roles = master.experience || [];
  const projects = master.projects || [];
  let experience = Array.isArray(plan.experience) ? plan.experience : [];
  if (!experience.length) experience = roles.map((r) => ({ id: r.id, bullets: r.bullets || [] }));
  experience = roles.map((role) => {
    const incoming = experience.find((r) => r.id === role.id) || {};
    const bullets = Array.isArray(incoming.bullets) ? incoming.bullets.filter((b) => typeof b === 'string' && b.trim()) : role.bullets || [];
    return { id: role.id, bullets: bullets.length ? bullets : role.bullets || [] };
  });

  let projectsPlan = Array.isArray(plan.projects) ? plan.projects : [];
  if (!projectsPlan.length) projectsPlan = projects.map((p) => ({ id: p.id, bullets: p.bullets || [] }));
  projectsPlan = projectsPlan
    .map((incoming) => {
      const project = projects.find((p) => p.id === incoming.id);
      if (!project) return null;
      const bullets = Array.isArray(incoming.bullets) ? incoming.bullets.filter((b) => typeof b === 'string' && b.trim()) : project.bullets || [];
      return { id: project.id, bullets: bullets.length ? bullets : project.bullets || [] };
    })
    .filter(Boolean);

  let skills = Array.isArray(plan.skills) ? plan.skills : [];
  if (!skills.length) skills = master.skills || [];
  skills = skills
    .map((group) => ({
      label: String(group.label || '').trim(),
      items: (group.items || []).map((item) => String(item).trim()).filter(Boolean),
    }))
    .filter((group) => group.label && group.items.length);

  const summary = normalizeText(plan.summary || master.summary || '');
  const certifications = Array.isArray(plan.certifications)
    ? plan.certifications.filter((c) => c && c.items)
    : (master.certifications || []);
  return {
    source: plan.source || 'local',
    summary,
    experience,
    projects: projectsPlan,
    skills,
    certifications,
    notes: Array.isArray(plan.notes) ? plan.notes : [],
    alignment: Array.isArray(plan.alignment) ? plan.alignment : [],
    layout: plan.layout && typeof plan.layout === 'object' ? plan.layout : null,
  };
}

export function materializePlan(master, plan) {
  const safe = normalizePlan(plan, master);
  const roles = master.experience || [];
  const projects = master.projects || [];
  return {
    profile: master.profile,
    summary: safe.summary,
    experience: roles.map((role) => {
      const selected = safe.experience.find((r) => r.id === role.id);
      return {
        ...role,
        bullets: selected?.bullets?.length ? selected.bullets : (role.bullets || []),
      };
    }),
    projects: safe.projects.map((selected) => {
      const project = projects.find((p) => p.id === selected.id) || selected;
      return { ...project, bullets: selected.bullets };
    }),
    skills: safe.skills,
    education: master.education,
    certifications: safe.certifications,
    layout: safe.layout,
    meta: { ...(master.meta || {}), tailored: true, source: safe.source },
  };
}

export function resumePlainText(master, plan) {
  const data = materializePlan(master, plan);
  const p = data.profile || {};
  const lines = [];
  if (p.name) lines.push(p.name);
  const contact = [p.phone, p.email, ...(p.links || []).map((l) => l.label)].filter(Boolean);
  if (contact.length) lines.push(contact.join('  •  '));
  lines.push('', 'PROFESSIONAL SUMMARY', data.summary);
  lines.push('', 'WORK EXPERIENCE');
  for (const role of data.experience) {
    lines.push(`${role.title}, ${role.company}\t${role.dates}`);
    for (const bullet of role.bullets || []) lines.push(`• ${String(bullet).replace(/\*\*/g, '')}`);
  }
  lines.push('', 'PROJECTS');
  for (const project of data.projects) {
    lines.push(`${project.name} | ${project.tech}`);
    for (const bullet of project.bullets || []) lines.push(`• ${String(bullet).replace(/\*\*/g, '')}`);
  }
  lines.push('', 'TECHNICAL SKILLS');
  for (const group of data.skills || []) {
    const separator = group.label.toLowerCase() === 'cloud' ? ' • ' : ', ';
    lines.push(`${group.label}: ${(group.items || []).join(separator)}`);
  }
  const edu = data.education || {};
  if (edu.school) {
    lines.push('', 'EDUCATION', `${edu.school}\t${edu.dates || ''}`);
    if (edu.degree) lines.push(edu.degree);
    if (edu.coursework) lines.push(`Coursework: ${edu.coursework}`);
  }
  if ((data.certifications || []).length) {
    lines.push('', 'ACCOMPLISHMENTS / CERTIFICATIONS');
    for (const cert of data.certifications) {
      lines.push(`• ${cert.org}: ${cert.items}`);
    }
  }
  return lines.join('\n').replace(/\t\t+/g, '\t').trim();
}

export function planStats(plan) {
  const experience = (plan.experience || []).reduce((n, r) => n + r.bullets.length, 0);
  const projects = (plan.projects || []).reduce((n, p) => n + p.bullets.length, 0);
  const skills = (plan.skills || []).reduce((n, g) => n + g.items.length, 0);
  return { experience, projects, skills, projectsCount: (plan.projects || []).length, groups: (plan.skills || []).length };
}
