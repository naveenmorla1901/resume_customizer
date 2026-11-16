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

function pageOne(data) {
  const roles = data.experience || [];
  return `<div class="resume-page" data-page="1"><div class="page-inner">
    <div class="resume-name">${escapeHtml(data.profile?.name || '')}</div>
    ${contactHtml(data.profile)}
    ${sectionTitle('PROFESSIONAL SUMMARY')}
    <p class="resume-summary">${markdownToHtml(data.summary || '')}</p>
    ${sectionTitle('WORK EXPERIENCE')}
    ${roles.map((role) => `${jobTitleHtml(role)}${bulletsHtml(role.bullets)}`).join('')}
  </div></div>`;
}

function pageTwo(data) {
  const groups = data.skills || [];
  const edu = data.education || {};
  const projects = data.projects || [];
  const certs = data.certifications || [];
  return `<div class="resume-page" data-page="2"><div class="page-inner">
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

export function renderResume(container, master, plan) {
  const data = materializePlan(master, plan);
  container.innerHTML = `<div class="resume-pages">${pageOne(data)}${pageTwo(data)}</div>`;
  return measureResume(container, data);
}

export function measureResume(container) {
  const pages = Array.from(container.querySelectorAll('.resume-page')).map((page) => {
    const inner = page.querySelector('.page-inner');
    const available = inner?.clientHeight || 0;
    // The inner element is exactly page-height, so scrollHeight always equals
    // clientHeight even when the content is shorter or (worse) overflows.
    // Measure the bottom of the last rendered block instead.
    let height = 0;
    if (inner) {
      const innerTop = inner.getBoundingClientRect().top;
      const last = inner.lastElementChild;
      if (last) {
        const lastStyle = getComputedStyle(last);
        const marginBottom = parseFloat(lastStyle.marginBottom) || 0;
        height = last.getBoundingClientRect().bottom + marginBottom - innerTop;
      }
    }
    return {
      page: Number(page.dataset.page || 0),
      available,
      height,
      overflow: height - available,
    };
  });
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
  return `<div class="resume-pages">${pageOne(data)}${pageTwo(data)}</div>`;
}

export function getPlainText(master, plan) {
  return resumePlainText(master, plan);
}
