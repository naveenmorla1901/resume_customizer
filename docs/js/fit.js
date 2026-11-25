import { renderResume } from './render.js';
import { defaultProjects, normalizePlan, shrinkSummary } from './tailor.js';

// The browser preview is a few points tighter than Word's Calibri layout.
// Keep enough room that a plan which looks full in Chrome cannot spill onto a
// third page when the same plan is exported to DOCX.
export const SAFETY_PX = 48;

export function basePlan(master) {
  return normalizePlan({
    source: 'base',
    summary: master.summary,
    experience: (master.experience || []).map((r) => ({ id: r.id, bullets: r.bullets || [] })),
    projects: defaultProjects(master).map((p) => ({ id: p.id, bullets: p.bullets || [] })),
    skills: master.skills || [],
    certifications: master.certifications || [],
  }, master);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fitsPage(page, safety = SAFETY_PX) {
  return page.overflow <= -safety;
}

function shrinkOnce(plan, minChars = 300) {
  if (plan.summary.length <= minChars) return false;
  const next = shrinkSummary(plan.summary, Math.max(minChars, plan.summary.length - 45));
  if (next === plan.summary) {
    const fallback = shrinkSummary(plan.summary, Math.max(minChars, Math.floor(plan.summary.length * 0.85)));
    if (fallback === plan.summary) return false;
    plan.summary = fallback;
    return true;
  }
  plan.summary = next;
  return true;
}

function reduceExperience(plan, changes) {
  const roles = plan.experience || [];
  if (!roles.length) return false;
  const mins = [4, 3, 2, 2];
  for (let i = roles.length - 1; i >= 1; i -= 1) {
    const min = i === 1 ? 3 : 2;
    if ((roles[i].bullets || []).length > min) {
      roles[i].bullets.pop();
      changes.experienceTrimmed += 1;
      return true;
    }
  }
  // Bullets written from the JD lead the latest role; keep at least two of
  // the role's own bullets beneath them.
  const jdLead = roles[0].jdLead || 0;
  const floor = Math.max(4, jdLead + 2);
  const hardMin = jdLead ? jdLead + 1 : 2;
  const latestMin = roles[0].bullets.length > floor ? floor : Math.min(roles[0].bullets.length, hardMin);
  if (roles[0].bullets.length > latestMin) {
    roles[0].bullets.pop();
    changes.experienceTrimmed += 1;
    return true;
  }
  return false;
}

function trimSkills(plan, maxItems, maxGroups, changes) {
  let changed = false;
  for (const group of plan.skills || []) {
    if (group.items.length > maxItems) {
      group.items = group.items.slice(0, maxItems);
      changed = true;
      changes.skillsTrimmed += 1;
    }
  }
  if ((plan.skills || []).length > maxGroups) {
    plan.skills = plan.skills.slice(0, maxGroups);
    changed = true;
    changes.groupsDropped += 1;
  }
  return changed;
}

function reduceProjectBullets(plan, min, changes) {
  for (let i = (plan.projects || []).length - 1; i >= 0; i -= 1) {
    const project = plan.projects[i];
    if ((project.bullets || []).length > min) {
      project.bullets.pop();
      changes.projectBulletsTrimmed += 1;
      return true;
    }
  }
  return false;
}

function reducePageTwo(plan, changes, state) {
  if (reduceProjectBullets(plan, 2, changes)) return true;
  if (state.skillsCap > 10 && trimSkills(plan, 10, 8, changes)) {
    state.skillsCap = 10;
    return true;
  }
  if ((plan.projects || []).length > 3) {
    plan.projects.pop();
    changes.projectsDropped += 1;
    return true;
  }
  if (state.skillsCap > 8 && trimSkills(plan, 8, 8, changes)) {
    state.skillsCap = 8;
    return true;
  }
  if ((plan.skills || []).length > 7) {
    plan.skills = plan.skills.slice(0, 7);
    changes.groupsDropped += 1;
    return true;
  }
  if (reduceProjectBullets(plan, 1, changes)) return true;
  if ((plan.skills || []).length > 6) {
    plan.skills = plan.skills.slice(0, 6);
    changes.groupsDropped += 1;
    return true;
  }
  if ((plan.projects || []).length > 2) {
    plan.projects.pop();
    changes.projectsDropped += 1;
    return true;
  }
  if ((plan.certifications || []).length > 1) {
    plan.certifications.pop();
    changes.certsTrimmed += 1;
    return true;
  }
  if (state.skillsCap > 6 && trimSkills(plan, 6, 6, changes)) {
    state.skillsCap = 6;
    return true;
  }
  return false;
}

/**
 * Trims a plan until the browser preview fits on two Letter pages with a
 * small safety margin. The same plan is then used for the DOCX, so Word
 * does not create a third page from a last-line overflow.
 */
export function fitPlan(master, inputPlan, stage, opts = {}) {
  const plan = clone(inputPlan);
  plan.certifications = plan.certifications || master.certifications || [];
  const changes = {
    summaryTrimmed: 0,
    experienceTrimmed: 0,
    rolesDropped: 0,
    projectBulletsTrimmed: 0,
    projectsDropped: 0,
    skillsTrimmed: 0,
    groupsDropped: 0,
    certsTrimmed: 0,
  };
  const safety = opts.safety ?? SAFETY_PX;
  const measure = () => renderResume(stage, master, plan);
  let measurement = measure();
  let guard = 0;

  while (!fitsPage(measurement.page1, safety) && guard < 40) {
    guard += 1;
    let changed = false;
    if (shrinkOnce(plan, 300)) {
      changes.summaryTrimmed += 1;
      changed = true;
    } else if (reduceExperience(plan, changes)) {
      changed = true;
    }
    if (!changed) break;
    measurement = measure();
  }

  const state = { skillsCap: 99 };
  guard = 0;
  while (!fitsPage(measurement.page2, safety) && guard < 60) {
    guard += 1;
    if (!reducePageTwo(plan, changes, state)) break;
    measurement = measure();
  }

  const fitted = fitsPage(measurement.page1, safety) && fitsPage(measurement.page2, safety);
  return {
    plan,
    measurement,
    fitted,
    changes,
    safety,
    summary: fitted
      ? 'Fits on two pages with a small safety margin.'
      : 'Still tight. Import a shorter master resume or trim content before exporting.',
  };
}
