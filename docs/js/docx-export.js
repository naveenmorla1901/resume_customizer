/**
 * DOCX export for Resume Studio.
 *
 * Recreates the master resume's Word layout:
 *   US Letter, 0.486" top/bottom, 0.6" left/right, Calibri,
 *   20pt name, 11pt section headings with a 0.75pt navy rule,
 *   10pt job/project titles, 9.5pt body, right tab at 6.5".
 *
 * The function takes the `docx` namespace as an argument so the same
 * code runs in the browser (window.docx) and in Node tests.
 */
import { parseInlineMarkdown } from './util.js';

const NAVY = '1F3864';
const BODY = '1A1A1A';
const GRAY = '555555';
const FONT = 'Calibri';
const BULLET_REF = 'resume-bullets';

function runsFromMarked(TextRun, text, opts = {}) {
  const size = opts.size ?? 19;
  const color = opts.color ?? BODY;
  const boldAll = opts.bold ?? false;
  const italicAll = opts.italic ?? false;
  const underlineAll = opts.underline ?? false;
  return parseInlineMarkdown(text).map((seg) => new TextRun({
    text: seg.text,
    bold: boldAll || seg.bold,
    italics: italicAll || seg.italic,
    underline: underlineAll ? {} : undefined,
    size,
    color,
    font: FONT,
  }));
}

function sectionHeading(docx, text, opts = {}) {
  const { Paragraph, TextRun, BorderStyle } = docx;
  return new Paragraph({
    pageBreakBefore: opts.pageBreakBefore ?? false,
    keepNext: true,
    spacing: {
      before: opts.pageBreakBefore ? 0 : 130,
      after: 44,
    },
    border: {
      bottom: {
        color: NAVY,
        space: 2,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
        color: NAVY,
        font: FONT,
      }),
    ],
  });
}

function bulletParagraph(docx, text, opts = {}) {
  const { Paragraph, TextRun } = docx;
  return new Paragraph({
    numbering: { reference: BULLET_REF, level: 0 },
    alignment: 'both',
    spacing: { before: 10, after: 10 },
    children: runsFromMarked(TextRun, text, { size: 19 }),
  });
}

function titleWithDate(docx, leftRuns, dates, opts = {}) {
  const { Paragraph, TextRun } = docx;
  const size = opts.size ?? 20;
  return new Paragraph({
    keepNext: true,
    tabStops: [{ type: 'right', position: 9360 }],
    spacing: { before: opts.before ?? 108, after: opts.after ?? 12 },
    children: [
      ...leftRuns,
      new TextRun({ children: ['\t'], font: FONT }),
      new TextRun({ text: dates, bold: true, size, font: FONT, color: BODY }),
    ],
  });
}

function contactLine(docx, profile) {
  const { Paragraph, TextRun, ExternalHyperlink } = docx;
  const sep = '  •  ';
  const children = [];
  const add = (text, opts = {}) => children.push(new TextRun({
    text,
    size: 19,
    font: FONT,
    color: opts.color ?? BODY,
    underline: opts.underline ? {} : undefined,
  }));
  add('• ');
  add(profile.phone);
  add(sep);
  add(profile.email);
  for (const link of profile.links || []) {
    add(sep);
    children.push(new ExternalHyperlink({
      link: link.url,
      children: [new TextRun({
        text: link.label,
        size: 19,
        font: FONT,
        color: NAVY,
        underline: {},
      })],
    }));
  }
  return new Paragraph({
    alignment: 'center',
    spacing: { after: 28 },
    children,
  });
}

function skillsParagraph(docx, group) {
  const { Paragraph, TextRun } = docx;
  const separator = group.label.toLowerCase() === 'cloud' ? ' • ' : ', ';
  return new Paragraph({
    alignment: 'both',
    spacing: { before: 22, after: 22 },
    children: [
      new TextRun({ text: `${group.label}: `, bold: true, size: 19, font: FONT, color: BODY }),
      new TextRun({ text: (group.items || []).join(separator), size: 19, font: FONT, color: BODY }),
    ],
  });
}

function buildNumbering(docx) {
  const { LevelFormat } = docx;
  return {
    config: [
      {
        reference: BULLET_REF,
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: 'left',
            style: {
              paragraph: { indent: { left: 360, hanging: 220 } },
            },
          },
        ],
      },
    ],
  };
}

export function buildResumeDocx(docx, master, tailored, opts = {}) {
  const {
    Document, Paragraph, TextRun, AlignmentType,
  } = docx;
  const data = tailored || master;
  const profile = master.profile;
  const children = [];

  // Name + contact
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 28 },
    children: [new TextRun({
      text: profile.name,
      bold: true,
      size: 40,
      color: NAVY,
      font: FONT,
    })],
  }));
  children.push(contactLine(docx, profile));

  // Summary
  children.push(sectionHeading(docx, 'PROFESSIONAL SUMMARY'));
  children.push(new Paragraph({
    alignment: 'both',
    spacing: { before: 55, after: 35 },
    children: runsFromMarked(TextRun, data.summary || '', { size: 19 }),
  }));

  // Experience
  children.push(sectionHeading(docx, 'WORK EXPERIENCE'));
  for (const role of data.experience || []) {
    const masterRole = (master.experience || []).find((r) => r.id === role.id) || role;
    children.push(titleWithDate(
      docx,
      [
        new TextRun({
          text: `${masterRole.title}, ${masterRole.company}`,
          bold: true,
          size: 20,
          font: FONT,
          color: BODY,
        }),
      ],
      masterRole.dates,
    ));
    for (const bullet of role.bullets || []) {
      children.push(bulletParagraph(docx, bullet));
    }
  }

  // Projects (page 2)
  children.push(sectionHeading(docx, 'PROJECTS', { pageBreakBefore: true }));
  for (const project of data.projects || []) {
    const masterProject = (master.projects || []).find((p) => p.id === project.id) || project;
    children.push(new Paragraph({
      keepNext: true,
      spacing: { before: 88, after: 12 },
      children: [
        new TextRun({
          text: masterProject.name,
          bold: true,
          underline: {},
          size: 20,
          color: NAVY,
          font: FONT,
        }),
        new TextRun({
          text: ` | ${masterProject.tech}`,
          italics: true,
          size: 18,
          font: FONT,
          color: BODY,
        }),
      ],
    }));
    for (const bullet of project.bullets || []) {
      children.push(bulletParagraph(docx, bullet));
    }
  }

  // Skills
  children.push(sectionHeading(docx, 'TECHNICAL SKILLS'));
  for (const group of data.skills || []) {
    children.push(skillsParagraph(docx, group));
  }

  // Education
  const edu = master.education || {};
  children.push(sectionHeading(docx, 'EDUCATION'));
  children.push(titleWithDate(
    docx,
    [new TextRun({ text: edu.school || '', bold: true, size: 20, font: FONT, color: BODY })],
    edu.dates || '',
    { before: 90, after: 8 },
  ));
  if (edu.degree) {
    children.push(new Paragraph({
      spacing: { after: 8 },
      children: [new TextRun({ text: edu.degree, italics: true, size: 19, font: FONT, color: BODY })],
    }));
  }
  if (edu.coursework) {
    children.push(new Paragraph({
      alignment: 'both',
      spacing: { after: 8 },
      children: [
        new TextRun({ text: 'Coursework: ', bold: true, size: 18, font: FONT, color: BODY }),
        new TextRun({ text: edu.coursework, size: 18, font: FONT, color: GRAY }),
      ],
    }));
  }

  // Certifications
  children.push(sectionHeading(docx, 'ACCOMPLISHMENTS / CERTIFICATIONS'));
  for (const cert of data.certifications || master.certifications || []) {
    const text = cert.org ? `**${cert.org}:** ${cert.items}` : cert.items;
    children.push(bulletParagraph(docx, text));
  }

  const doc = new Document({
    creator: profile.name,
    title: opts.title || `${profile.name} — Resume`,
    description: 'ATS-friendly resume tailored from a master resume.',
    subject: opts.subject || 'Resume',
    keywords: opts.keywords || '',
    styles: {
      default: {
        document: {
          run: { font: FONT, color: BODY },
          paragraph: { spacing: { after: 0 } },
        },
      },
    },
    numbering: buildNumbering(docx),
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 700, right: 864, bottom: 700, left: 864 },
          },
        },
        children,
      },
    ],
  });
  return doc;
}

export async function createDocxBlob(docx, master, tailored, opts = {}) {
  const doc = buildResumeDocx(docx, master, tailored, opts);
  return docx.Packer.toBlob(doc);
}
