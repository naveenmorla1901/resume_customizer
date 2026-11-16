import { escapeHtml, markdownToHtml } from './util.js';
import { materializePlan, resumePlainText } from './tailor.js';

function contactHtml(profile = {}) {
  const parts = [];
  if (profile.phone) parts.push(escapeHtml(profile.phone));
  if (profile.email) parts.push(escapeHtml(profile.email));
  for (const link of profile.links || []) {
    if (!link.label) continue;
    const url = link.url ? ` href="${escapeHtml(link.url)}"` : '';
    parts.push(`<a${url} target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`);
  }
  if (!parts.length) return '';
  return `<div class="resume-contact"><span class="contact-dot">•</span> ${parts.join('<span class="contact-sep">•</span>')}</div>`;
}

function sectionTitle(text, extraClass = '') {
  return `<h2 class="section-title ${extraClass}">${escapeHtml(text)}</h2>`;
}

function bulletsHtml(bullets = []) {
  if (!bullets.length) return '';
  return `<div class="resume-bullets">${bullets.map((bullet) => (
    `<div class="resume-bullet"><span class="bullet-mark">•</span><span class="bullet-text">${markdownToHtml(bullet)}</span></div>`
  )).join('')}</div>`;
}

function jobTitleHtml(role) {
  const left = [role.title, role.company].filter(Boolean).join(', ');
  return `<div class="job-title"><span class="job-left">${escapeHtml(left)}</span><span class="job-dates">${escapeHtml(role.dates || '')}</span></div>`;
}

function projectTitleHtml(project) {
  return `<div class="project-title"><span class="project-name">${escapeHtml(project.name || '')}</span>${project.tech ? `<span class="project-tech"> | ${escapeHtml(project.tech)}</span>` : ''}</div>`;
}

function layoutStyle(layout, pageNumber) {
  const page = layout?.[`page${pageNumber}`];
  if (!page) return '';
  return ` style="--fill-line:${Number(page.line) || 0}pt;--fill-gap:${Number(page.gap) || 0}pt;--fill-small:${Number(page.small) || 0}pt"`;
}

function pageOne(data, layout) {
  const roles = data.experience || [];
  return `<div class="resume-page" data-page="1"${layoutStyle(layout, 1)}><div class="page-inner">
    <div class="resume-name">${escapeHtml(data.profile?.name || '')}</div>
    ${contactHtml(data.profile)}
    ${sectionTitle('PROFESSIONAL SUMMARY')}
    <p class="resume-summary">${markdownToHtml(data.summary || '')}</p>
    ${sectionTitle('WORK EXPERIENCE')}
    ${roles.map((role) => `${jobTitleHtml(role)}${bulletsHtml(role.bullets)}`).join('')}
  </div></div>`;
}

function pageTwo(data, layout) {
  const groups = data.skills || [];
  const edu = data.education || {};
  const projects = data.projects || [];
  const certs = data.certifications || [];
  return `<div class="resume-page" data-page="2"${layoutStyle(layout, 2)}><div class="page-inner">
    ${sectionTitle('PROJECTS', 'section-title-first')}
    ${projects.map((project) => `${projectTitleHtml(project)}${bulletsHtml(project.bullets)}`).join('')}
    ${sectionTitle('TECHNICAL SKILLS')}
    <div class="resume-skills">${groups.map((group) => {
      const separator = group.label.toLowerCase() === 'cloud' ? ' • ' : ', ';
      return `<div class="skill-group"><strong>${escapeHtml(group.label)}:</strong> ${escapeHtml((group.items || []).join(separator))}</div>`;
    }).join('')}</div>
    ${sectionTitle('EDUCATION')}
    <div class="education-block">
      <div class="job-title education-title"><span class="job-left">${escapeHtml(edu.school || '')}</span><span class="job-dates">${escapeHtml(edu.dates || '')}</span></div>
      ${edu.degree ? `<div class="education-degree">${escapeHtml(edu.degree)}</div>` : ''}
      ${edu.coursework ? `<div class="education-coursework"><strong>Coursework:</strong> ${escapeHtml(edu.coursework)}</div>` : ''}
    </div>
    ${sectionTitle('ACCOMPLISHMENTS / CERTIFICATIONS')}
    ${bulletsHtml(certs.map((cert) => cert.org ? `**${cert.org}:** ${cert.items}` : cert.items))}
  </div></div>`;
}

function pageHeight(page) {
  const inner = page.querySelector('.page-inner');
  if (!inner) return { available: 0, height: 0, overflow: 0 };
  const available = inner.clientHeight || 0;
  const last = inner.lastElementChild;
  let height = 0;
  if (last) {
    const marginBottom = parseFloat(getComputedStyle(last).marginBottom) || 0;
    // Use layout offsets instead of getBoundingClientRect: the preview is
    // scaled down on narrow screens, and rects would return transformed
    // pixels while clientHeight stays in CSS pixels.
    height = last.offsetTop + last.offsetHeight + marginBottom - inner.offsetTop;
  }
  return { available, height, overflow: height - available };
}

const FILL_LIMITS = {
  line: 0.62,
  gap: 2.5,
  small: 1.15,
};

function setPageFill(page, k = 0) {
  const value = Math.max(0, Math.min(1, Number(k) || 0));
  page.style.setProperty('--fill-line', `${(value * FILL_LIMITS.line).toFixed(3)}pt`);
  page.style.setProperty('--fill-gap', `${(value * FILL_LIMITS.gap).toFixed(3)}pt`);
  page.style.setProperty('--fill-small', `${(value * FILL_LIMITS.small).toFixed(3)}pt`);
}

/**
 * Add a small, controlled amount of vertical breathing room so a page does
 * not end with a large blank block. The binary search never consumes the full
 * safety margin, so Word still has room for its slightly different metrics.
 */
export function applyResumeFill(container, opts = {}) {
  const target = opts.target ?? 26; // px left above the bottom margin
  const layout = {};
  const pages = Array.from(container.querySelectorAll('.resume-page'));
  for (const page of pages) {
    const pageNumber = Number(page.dataset.page || 0);
    setPageFill(page, 0);
    const base = pageHeight(page);
    const spare = base.available - base.height;
    let best = 0;
    if (spare > target + 4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 7; i += 1) {
        const mid = (lo + hi) / 2;
        setPageFill(page, mid);
        const measured = pageHeight(page);
        if (measured.available - measured.height >= target) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      best = lo;
      setPageFill(page, best);
    }
    const final = pageHeight(page);
    const consumedPt = Math.max(0, (final.height - base.height) / (96 / 72));
    layout[`page${pageNumber}`] = {
      line: Number((best * FILL_LIMITS.line).toFixed(3)),
      gap: Number((best * FILL_LIMITS.gap).toFixed(3)),
      small: Number((best * FILL_LIMITS.small).toFixed(3)),
      extraPt: Number(consumedPt.toFixed(1)),
      blankPx: Math.max(0, Math.round(final.available - final.height)),
    };
    page.dataset.fill = String(best.toFixed(3));
  }
  return { layout, measurement: measureResume(container) };
}

export function renderResume(container, master, plan, opts = {}) {
  const data = materializePlan(master, plan);
  const layout = opts.includeLayout ? plan?.layout : null;
  container.innerHTML = `<div class="resume-pages">${pageOne(data, layout)}${pageTwo(data, layout)}</div>`;
  return measureResume(container, data);
}

export function measureResume(container) {
  const pages = Array.from(container.querySelectorAll('.resume-page')).map((page) => ({
    page: Number(page.dataset.page || 0),
    ...pageHeight(page),
  }));
  const page1 = pages.find((p) => p.page === 1) || { overflow: 0 };
  const page2 = pages.find((p) => p.page === 2) || { overflow: 0 };
  return {
    pages,
    page1,
    page2,
    fits: page1.overflow <= -10 && page2.overflow <= -10,
  };
}

export function renderResumeHtml(master, plan) {
  const data = materializePlan(master, plan);
  return `<div class="resume-pages">${pageOne(data, data.layout)}${pageTwo(data, data.layout)}</div>`;
}

export function getPlainText(master, plan) {
  return resumePlainText(master, plan);
}
