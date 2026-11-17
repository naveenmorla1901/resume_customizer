import { readFileAsArrayBuffer, readFileAsText } from './util.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SECTION_HEADINGS = {
  summary: /^(professional\s+summary|summary|profile|objective)$/i,
  experience: /^(work\s+experience|professional\s+experience|experience|employment(\s+history)?)$/i,
  projects: /^(projects|selected\s+projects|personal\s+projects)$/i,
  skills: /^(technical\s+skills|skills|core\s+competencies|technologies)$/i,
  education: /^(education|academic\s+background)$/i,
  certifications: /^(accomplishments\s*\/\s*certifications|certifications|accomplishments|awards|certifications\s*&\s*awards)$/i,
};

const DATE_RE = /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*(?:–|—|−|-|to)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i;

function localName(node) {
  return node.localName || String(node.nodeName || '').split(':').pop();
}

function paragraphText(node) {
  if (node.nodeType === 3) return node.nodeValue || '';
  if (node.nodeType !== 1) return '';
  const name = localName(node);
  if (name === 't') return node.textContent || '';
  if (name === 'tab') return '\t';
  if (name === 'br' || name === 'cr') return '\n';
  if (name === 'instrText' || name === 'delText') return '';
  return Array.from(node.childNodes).map(paragraphText).join('');
}

function isBullet(paragraph) {
  return Boolean(paragraph.getElementsByTagNameNS(W_NS, 'numPr').length);
}

function cleanLine(value = '') {
  return String(value).replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function slugify(value, fallback = 'item') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function stripBullet(value = '') {
  return String(value).replace(/^\s*[•●○▪■◦\-–—*]\s*/, '').trim();
}

function splitDate(line = '') {
  const text = String(line).replace(/\t/g, ' ');
  const match = text.match(DATE_RE);
  if (!match) return { text: cleanLine(text), dates: '' };
  return {
    text: cleanLine(text.replace(match[0], '').replace(/[\t|,;]+$/, '')),
    dates: cleanLine(match[0]).replace(/\s+/g, ' ').replace(/\bto\b/i, '–'),
  };
}

function splitTitleCompany(line = '') {
  const text = cleanLine(line);
  const at = text.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim() };
  const parts = text.split(/\s*,\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts.slice(0, -1).join(', '), company: parts[parts.length - 1] };
  }
  return { title: text, company: '' };
}

function splitSkills(value = '') {
  const text = String(value).trim();
  if (/[•●]/.test(text)) {
    return text.split(/[•●]/).map((s) => s.trim()).filter(Boolean);
  }
  const parts = [];
  let current = '';
  let depth = 0;
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function parseContact(line, hyperlinks = []) {
  const text = cleanLine(line);
  const chunks = text.split(/[•●|]/).map((s) => s.trim()).filter(Boolean);
  let phone = '';
  let email = '';
  const links = [];
  for (const chunk of chunks) {
    if (!phone && /(?:\+?\d[\d\s().-]{7,}\d)/.test(chunk) && !/@/.test(chunk)) {
      phone = chunk;
    } else if (!email && /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(chunk)) {
      email = chunk.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)[0];
    } else if (chunk && !/^https?:/i.test(chunk)) {
      links.push(chunk);
    }
  }
  if (!phone) {
    const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
    if (match) phone = match[0].trim();
  }
  if (!email) {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) email = match[0];
  }
  const normalizedLinks = [];
  for (const hyperlink of hyperlinks) {
    const label = cleanLine(hyperlink.label || '');
    const url = hyperlink.url || '';
    if (!url || /^mailto:/i.test(url)) continue;
    // The DOCX contains hyperlinks in project titles too. Only keep the ones
    // whose visible label appears on the contact line.
    if (!label || !text.includes(label)) continue;
    if (!normalizedLinks.some((l) => l.label === label)) {
      normalizedLinks.push({ label, url });
    }
  }
  for (const label of links) {
    if (normalizedLinks.some((l) => l.label === label)) continue;
    if (/linkedin|github|portfolio|https?:\/\//i.test(label)) {
      const url = /^https?:\/\//i.test(label) ? label : `https://${label.replace(/^www\./i, '')}`;
      normalizedLinks.push({ label, url });
    }
  }
  return { phone, email, links: normalizedLinks.slice(0, 5) };
}

function extractHyperlinks(documentXml, relsXml) {
  const rels = new Map();
  if (relsXml) {
    const relDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
    for (const rel of Array.from(relDoc.getElementsByTagName('Relationship'))) {
      rels.set(rel.getAttribute('Id'), rel.getAttribute('Target'));
    }
  }
  const links = [];
  for (const link of Array.from(documentXml.getElementsByTagNameNS(W_NS, 'hyperlink'))) {
    const id = link.getAttributeNS(R_NS, 'id') || link.getAttribute('r:id');
    const label = cleanLine(paragraphText(link));
    const url = rels.get(id);
    if (label && url) links.push({ label, url });
  }
  return links;
}

export function normalizeImportedMaster(raw = {}) {
  const data = raw.master || raw.resume || raw;
  if (!data || typeof data !== 'object') throw new Error('That JSON file does not contain a resume object.');
  const profile = data.profile || data.contact || {};
  const links = Array.isArray(profile.links) ? profile.links : [];
  const experience = (Array.isArray(data.experience) ? data.experience : data.workExperience || [])
    .map((role, index) => ({
      id: role.id || slugify(`${role.company || ''}-${role.title || ''}`, `role-${index + 1}`),
      title: String(role.title || ''),
      company: String(role.company || ''),
      dates: String(role.dates || role.date || ''),
      bullets: (Array.isArray(role.bullets) ? role.bullets : []).map(String).filter(Boolean),
    }))
    .filter((role) => role.title || role.company);
  if (!experience.length) throw new Error('No work experience found in the resume.');
  const projects = (Array.isArray(data.projects) ? data.projects : [])
    .map((project, index) => ({
      id: project.id || slugify(project.name || '', `project-${index + 1}`),
      name: String(project.name || ''),
      tech: String(project.tech || project.technologies || ''),
      bullets: (Array.isArray(project.bullets) ? project.bullets : []).map(String).filter(Boolean),
      // Keep library metadata so re-importing an exported master JSON does not
      // drop project links, the private flag, or the featured/default flags.
      ...(project.link ? { link: String(project.link) } : {}),
      ...(project.url ? { url: String(project.url) } : {}),
      ...(project.linkLabel ? { linkLabel: String(project.linkLabel) } : {}),
      ...(typeof project.featured === 'boolean' ? { featured: project.featured } : {}),
      ...(project.private ? { private: true } : {}),
    }))
    .filter((project) => project.name);
  const skills = (Array.isArray(data.skills) ? data.skills : [])
    .map((group) => ({
      label: String(group.label || group.name || '').trim(),
      items: (Array.isArray(group.items) ? group.items : []).map(String).map((s) => s.trim()).filter(Boolean),
    }))
    .filter((group) => group.label && group.items.length);
  return {
    schemaVersion: 1,
    profile: {
      name: String(profile.name || ''),
      phone: String(profile.phone || ''),
      email: String(profile.email || ''),
      links: links
        .map((link) => ({ label: String(link.label || '').trim(), url: String(link.url || '').trim() }))
        .filter((link) => link.label && link.url)
        .slice(0, 5),
    },
    summary: String(data.summary || ''),
    experience,
    projects,
    skills,
    education: {
      school: String(data.education?.school || ''),
      dates: String(data.education?.dates || ''),
      degree: String(data.education?.degree || ''),
      coursework: String(data.education?.coursework || ''),
    },
    certifications: (Array.isArray(data.certifications) ? data.certifications : [])
      .map((cert) => (typeof cert === 'string' ? { org: '', items: cert } : { org: String(cert.org || ''), items: String(cert.items || '') }))
      .filter((cert) => cert.items),
    meta: {
      ...(data.meta || {}),
      imported: true,
      updated: new Date().toISOString().slice(0, 10),
    },
  };
}

export function parseDocxXml(documentXml, relsXml) {
  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Word document XML could not be parsed.');
  }
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] || doc.documentElement;
  const paragraphs = Array.from(body.getElementsByTagNameNS(W_NS, 'p'))
    .map((p) => ({
      text: cleanLine(paragraphText(p)),
      raw: paragraphText(p),
      bullet: isBullet(p),
    }))
    .filter((p) => p.text || p.raw.includes('\t'));

  if (!paragraphs.length) throw new Error('No text found in that Word document.');
  const hyperlinks = extractHyperlinks(doc, relsXml);

  let index = 0;
  const name = paragraphs[index]?.text || '';
  index += 1;
  const contact = parseContact(paragraphs[index]?.text || '', hyperlinks);
  index += 1;

  const sections = { summary: [], experience: [], projects: [], skills: [], education: [], certifications: [] };
  let current = 'summary';
  for (; index < paragraphs.length; index += 1) {
    const p = paragraphs[index];
    const headingKey = Object.keys(SECTION_HEADINGS).find((key) => SECTION_HEADINGS[key].test(p.text));
    if (headingKey) {
      current = headingKey;
      continue;
    }
    sections[current].push(p);
  }

  const summary = sections.summary.map((p) => p.text).join(' ').trim();

  const experience = [];
  let currentRole = null;
  for (const p of sections.experience) {
    if (p.bullet) {
      if (currentRole && p.text) currentRole.bullets.push(stripBullet(p.text));
      continue;
    }
    if (!p.text) continue;
    const { text, dates } = splitDate(p.text);
    if (!text) continue;
    const { title, company } = splitTitleCompany(text);
    currentRole = {
      id: slugify(`${company}-${title}`, `role-${experience.length + 1}`),
      title,
      company,
      dates,
      bullets: [],
    };
    experience.push(currentRole);
  }

  const projects = [];
  let currentProject = null;
  for (const p of sections.projects) {
    if (p.bullet) {
      if (currentProject && p.text) currentProject.bullets.push(stripBullet(p.text));
      continue;
    }
    if (!p.text) continue;
    const [name, ...techParts] = p.text.split('|');
    currentProject = {
      id: slugify(name, `project-${projects.length + 1}`),
      name: cleanLine(name),
      tech: cleanLine(techParts.join('|')),
      bullets: [],
    };
    projects.push(currentProject);
  }

  const skills = [];
  for (const p of sections.skills) {
    if (!p.text) continue;
    const match = p.text.match(/^([^:]{2,45}):\s*(.+)$/);
    if (match) {
      skills.push({ label: cleanLine(match[1]), items: splitSkills(match[2]) });
    } else if (skills.length) {
      // The original resume wraps "• Oracle Cloud" onto its own line.
      const item = stripBullet(p.text);
      if (item) skills[skills.length - 1].items.push(item);
    }
  }

  const education = { school: '', dates: '', degree: '', coursework: '' };
  for (const p of sections.education) {
    if (!p.text) continue;
    if (/^coursework\s*:/i.test(p.text)) {
      education.coursework = cleanLine(p.text.replace(/^coursework\s*:\s*/i, ''));
      continue;
    }
    const { text, dates } = splitDate(p.text);
    if (!education.school) {
      education.school = text;
      education.dates = dates;
    } else if (!education.degree) {
      education.degree = text;
    } else {
      education.degree += ` ${text}`;
    }
  }

  const certifications = [];
  for (const p of sections.certifications) {
    const text = stripBullet(p.text);
    if (!text) continue;
    const match = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (match) certifications.push({ org: cleanLine(match[1]), items: cleanLine(match[2]) });
    else certifications.push({ org: '', items: cleanLine(text) });
  }

  if (!experience.length) throw new Error('Could not find work experience in that Word document.');
  return normalizeImportedMaster({
    profile: { name, ...contact },
    summary,
    experience,
    projects,
    skills,
    education,
    certifications,
  });
}

export async function parseDocxFile(file) {
  const zipLib = globalThis.JSZip;
  if (!zipLib) throw new Error('The DOCX reader failed to load. Refresh the page and try again.');
  const buffer = await readFileAsArrayBuffer(file);
  const zip = await zipLib.loadAsync(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('That file is not a valid .docx Word document.');
  const documentXml = await documentFile.async('text');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const relsXml = relsFile ? await relsFile.async('text') : '';
  return parseDocxXml(documentXml, relsXml);
}

export async function importResumeFile(file) {
  if (!file) throw new Error('Choose a .docx or .json file.');
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.json')) {
    const text = await readFileAsText(file);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('That JSON file is not valid JSON.');
    }
    return normalizeImportedMaster(parsed);
  }
  if (name.endsWith('.docx')) return parseDocxFile(file);
  throw new Error('Use a .docx or .json resume file.');
}
