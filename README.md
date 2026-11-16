# Resume Studio

**ATS-first resume tailoring for Naveen Morla's two-page resume.**

[Open the app](https://naveenmorla1901.github.io/resume_customizer/) · [How it works](#how-it-works) · [Run locally](#run-locally) · [Legacy app](#legacy-fastapi-app)

Resume Studio is a static, no-backend web app. Paste a job description or its URL, and it selects, reorders, aligns, and trims existing resume content to emphasize the job's requirements while preserving the original layout, fonts, section order, and two-page format.

The app is plain HTML, CSS, and JavaScript in [`docs/`](docs/) and is deployed with GitHub Pages. There is no account, database, build step, or server.

## What it does

- **Keeps the resume's design.** Exports a DOCX that matches the original Word layout: Letter paper, the same margins, Calibri/Carlito typography, navy section headings, right-aligned dates, and the same section order.
- **Reads a job posting URL.** Paste a link instead of the description; the app reads the full posting through Jina Reader with public-reader and direct-fetch fallbacks. The URL is replaced by the extracted text so it can be reviewed and saved.
- **Emphasizes the latest role.** Lisinski Law Firm leads the experience section, with its most JD-relevant bullets first and its full bullet set kept whenever the two-page budget allows. JD wording is added only where that role already supports the same fact.
- **Bolds the skills that matter.** Existing bold is preserved. Up to three JD-relevant terms per experience bullet are bolded in the preview, PDF, and DOCX, so a recruiter can scan the important tools without the font or layout changing.
- **Prioritizes relevant tools.** Existing skills are regrouped and filtered so JD-relevant tools lead; unrelated tools are removed rather than added.
- **Uses experimentation evidence honestly.** When a job asks for experimentation and the resume already documents A/B tests and hypothesis testing, the exact word is surfaced in the summary, skills, and the relevant older role. It is never inserted into a role that lacks that evidence.
- **Protects project keywords.** Projects and project bullets that are the only source of a JD keyword are ranked first, so trimming does not discard the only match.
- **Explains ATS gaps.** Every missing keyword says whether it is in the master resume but was not selected, or absent from the resume entirely. Missing tools such as TypeScript are never added silently.
- **Protects the two-page limit.** A fit pass measures the rendered preview and trims the summary and expendable content (older-role bullets, project bullets, lower-priority skill groups) until both pages fit with a safety margin. A fill pass then adds a small, capped amount of vertical spacing so neither page ends with a large empty block; the font size does not change.
- **Produces ATS-friendly output.** Single-column text, real DOCX paragraphs and bullet lists, no text boxes or images, and a selectable-text PDF path.
- **Works without AI.** Local tailoring deterministically scores, selects, and aligns existing content. DeepSeek is optional and can improve selection plus JD-aligned wording.
- **Keeps data in the browser.** Resume content, the job description, and non-secret settings are stored in `localStorage`. The DeepSeek API key is kept in memory for the current tab only. There is no backend and no analytics.

## How it works

1. **Extract the job requirements.** The app pulls the title, years of experience, degree preference, tools, and ATS keywords from the pasted job description or an imported posting URL.
2. **Select existing content.** Every bullet, project, and skill group in the master resume is scored against those requirements; certifications remain in the plan and are trimmed only if space runs out.
3. **Align the summary and latest role.** Local mode promotes JD vocabulary only where the latest role already supports the same fact, such as “predictive forecasting” for an existing forecasting-model bullet. The summary may use tools that exist anywhere in the master resume.
4. **Optionally ask DeepSeek.** With a key entered for this visit, DeepSeek receives the job description and the resume with phone, email, and link URLs removed. It returns a JSON plan containing bullet indices, project choices, skill selections, and a summary. When **Allow JD-aligned rewording** is on, it may also reword the summary and latest-role bullets, but every metric must already appear in that role and every tool must already appear in that same role.
5. **Fit and fill two pages.** The selected content is rendered in the exact page layout, measured, trimmed if necessary, then given a controlled amount of breathing room so both pages look full without changing the font.
6. **Export.** Download a DOCX, print to PDF, or copy the plain text.

The AI is deliberately constrained by its prompt: it may select, reorder, reword, and trim existing content, but not invent employers, dates, degrees, metrics, tools, or achievements. The app enforces those constraints on every bullet, project, and skill choice, and falls back to a local summary if the AI's summary adds an unknown number or technology term. If the AI call fails, the local plan is used instead.

## Use the app

After Pages is enabled and the workflow has run, the app is at **https://naveenmorla1901.github.io/resume_customizer/**.

1. On first run, choose **Import my resume** and select the original `.docx` (or **Use Naveen's starter resume**).
2. Open **Edit contact** and add the phone number, email, and links you want on the resume. The public starter ships with blank phone and email on purpose.
3. Paste the full job description, including the title, requirements, and preferred qualifications. You can also paste a job posting URL into the **Or paste a job posting URL** box, or directly into the description box; the app reads the full posting and replaces the URL with its text.
4. Leave **DeepSeek selection** on if you entered an API key for this visit; otherwise local tailoring runs. The key is never carried over from a previous visit.
5. Select **Tailor my resume**.
6. Review the match report, the missing-keyword explanations, the changes list, and the live two-page preview.
7. Select **Download DOCX** for applications that accept Word files, or **Print / PDF** and choose *Save as PDF*.

For a PDF, use Letter paper, default margins, and 100% scale. Enable background graphics if your browser's preview drops the heading accents.

### Reading the ATS report

The score is a transparent heuristic, not an ATS vendor prediction. Missing keywords are labeled in two ways:

- **In your master, not selected in this version** — the skill exists in the full master resume but was trimmed for space or relevance. Tailor again if you need it.
- **Not in your resume — not auto-added** — the job asks for a skill the resume does not support. The app will not invent it. Add it only if you truly have that experience.

Terms outside the controlled skill taxonomy are listed separately for manual review. A keyword such as TypeScript appears only when the source resume actually contains it.

### Importing and exporting

- **Import `.docx`** extracts the resume's contact details, summary, experience, projects, skills, education, and certifications, then renders it with the built-in two-page template.
- **Import `.json`** restores a previous export.
- **Export JSON** saves a portable copy of the current master resume. Contact details are included, so keep the file private.
- **Reset to starter** restores the public starter content without contact details.
- **Clear all local data** removes the resume, plan, saved settings, and job description from the browser and clears the in-memory API key.

A full private master copy can live in `master/naveen-morla.json`. The `master/` directory is gitignored and is never published.

## DeepSeek setup (optional)

Open **Settings → DeepSeek API** and enter a key from [platform.deepseek.com](https://platform.deepseek.com/api_keys). The defaults are:

| Setting | Value |
| --- | --- |
| Model | `deepseek-flash` |
| Endpoint | `https://api.deepseek.com/chat/completions` |
| Thinking | Disabled |
| Response format | JSON object |

Use **Test connection** to verify the key. Requests go directly from the browser to DeepSeek; no server proxies them.

The key is **memory-only**. It is kept in a JavaScript variable for the current tab, never written to `localStorage`, and never prefilled into the field. Reloading, closing the tab, or selecting **Forget key** removes it. Enter the key again on each visit. Because the key exists in the browser while you use the app, use a dedicated key with a spending limit and avoid shared computers.

The **Allow JD-aligned rewording of the summary and latest role** checkbox is on by default. When enabled, DeepSeek may mirror the job's vocabulary in those two places only. Validation requires every number to already appear in the latest role, and every tool to already appear in the same role; the summary may use tools from anywhere in the master resume. Turn it off for selection-only tailoring.

If the browser or network blocks the request (CORS, offline, expired key, or insufficient balance), the app reports the error and you can retry or use local tailoring.

Without a key, everything except the DeepSeek selection step still works.

## Two-page behavior

The preview is the source of truth. The fitter reserves a safety margin to account for small browser-versus-Word layout differences. When page 1 overflows, it trims the summary, then reduces bullets from the oldest roles forward. When page 2 overflows, it trims project bullets, then whole projects, then skill items and groups, with certifications as a last resort.

After fitting, a fill pass measures each page and adds a small, capped amount of line height and section spacing until the content ends near the bottom margin. It leaves a deliberate buffer rather than stretching to the edge. The font size stays at 9.5pt, matching the original resume. The DOCX exporter applies only a conservative share of the measured fill so Word keeps the same two pages.

The latest role is the last experience section to be reduced and is never dropped. If the content still cannot fit after every trim, the app keeps the result and shows a warning rather than silently cutting the remaining material.

Print/PDF uses the same filled layout as the preview. Download DOCX uses the same plan with Word-calibrated spacing.

## Run locally

No install or build is required. Serve `docs/` over HTTP so ES modules and `fetch` behave normally:

```bash
python -m http.server 8765 --directory docs
```

Then open <http://127.0.0.1:8765/>.

Any static server works. Opening `docs/index.html` directly from disk may fail because browsers restrict ES module imports on `file://` URLs.

There are no npm dependencies at runtime. The DOCX exporter and ZIP writer are vendored in `docs/js/vendor/`, and the Carlito font files are vendored in `docs/fonts/`. The app has no CDN dependencies; every asset is served from the same static site.

## Deploy to GitHub Pages

The workflow at [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publishes `docs/` whenever `main` changes.

1. In the repository, open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main`, or run the **Deploy static resume tool to GitHub Pages** workflow manually.

The site will be available at `https://<user>.github.io/resume_customizer/`. `docs/.nojekyll` disables Jekyll processing.

## Project layout

```text
docs/
├── index.html              # App shell and modals
├── .nojekyll               # GitHub Pages: skip Jekyll
├── css/styles.css          # UI, resume paper, print styles
├── fonts/                  # Carlito (Calibri-metric) webfonts
├── favicon.svg
└── js/
    ├── app.js              # UI controller
    ├── ai.js               # DeepSeek client, prompt, plan validation
    ├── ats.js              # JD extraction and ATS scoring
    ├── tailor.js           # Local selection, plan materialization, text export
    ├── fit.js              # Two-page fitting
    ├── render.js           # Resume preview renderer and measurement
    ├── docx-export.js      # Calibrated Word exporter
    ├── docx-import.js      # DOCX/JSON import
    ├── emphasis.js         # Capped JD-keyword bolding for existing bullets
    ├── jd-import.js        # Job-posting URL reader and HTML cleanup
    ├── demo-data.js        # Public starter resume and sample JD
    ├── store.js            # localStorage persistence; memory-only API key
    ├── taxonomy.js         # Skill/keyword taxonomy
    ├── util.js
    └── vendor/             # docx, JSZip, licenses
master/
└── naveen-morla.json       # Local-only full master (gitignored)
```

## Privacy

- Resume data never leaves the browser unless **DeepSeek selection** is enabled and a request is made.
- When AI is enabled, the request contains the job description and the resume with phone, email, and link URLs removed; the name and link labels remain.
- The API key is memory-only and is sent only to the configured endpoint as a bearer token. It is never stored in `localStorage` and is not prefilled after a reload.
- Loading a job URL sends that URL to Jina Reader (`r.jina.ai`), with a public read-only proxy (`allorigins.win`) and a direct fetch as fallbacks. Only the extracted job text is saved locally.
- There is no backend, account, cookie, or analytics.
- The public repository contains a starter resume. Do not commit a private master resume or an API key.

## Legacy FastAPI app

The repository still contains the earlier FastAPI + Supabase application in `app/`, `frontend/`, `requirements.txt`, and `docker-compose.yml`. It uses LaTeX/PDF generation, authentication, and server-side AI providers. It is not used by the static app.

Setup and troubleshooting for that version are in [SETUP.md](SETUP.md). The static app requires none of it.

## License

MIT. Vendored third-party licenses are in `docs/js/vendor/`.
