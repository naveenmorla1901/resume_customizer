# Resume Studio

**ATS-first resume tailoring for Naveen Morla's two-page resume.**

[Open the app](https://naveenmorla1901.github.io/resume_customizer/) · [How it works](#how-it-works) · [Run locally](#run-locally) · [Legacy app](#legacy-fastapi-app)

Resume Studio is a static, no-backend web app. Paste a job description, and it reorders and trims existing resume content to emphasize the job's requirements while preserving the original layout, fonts, section order, and two-page format.

The app is plain HTML, CSS, and JavaScript in [`docs/`](docs/) and is deployed with GitHub Pages. There is no account, database, build step, or server.

## What it does

- **Keeps the resume's design.** Exports a DOCX that matches the original Word layout: Letter paper, the same margins, Calibri/Carlito typography, navy section headings, right-aligned dates, and the same section order.
- **Emphasizes the latest role.** Lisinski Law Firm leads the experience section, with its most JD-relevant bullets first and its full bullet set kept whenever the two-page budget allows.
- **Prioritizes relevant tools.** Existing skills are regrouped and filtered so JD-relevant tools lead; unrelated tools are removed rather than added.
- **Protects the two-page limit.** A fit pass measures the rendered preview and trims the summary and expendable content (older-role bullets, project bullets, lower-priority skill groups) until both pages fit with a safety margin.
- **Produces ATS-friendly output.** Single-column text, real DOCX paragraphs and bullet lists, no text boxes or images, and a selectable-text PDF path.
- **Works without AI.** Local tailoring deterministically scores and selects existing content. DeepSeek is optional and only improves selection and ordering.
- **Keeps data in the browser.** Resume content, the job description, settings, and the API key are stored in `localStorage`. There is no backend and no analytics.

## How it works

1. **Extract the job requirements.** The app pulls the title, years of experience, degree preference, tools, and ATS keywords from the pasted job description.
2. **Select existing content.** Every bullet, project, and skill group in the master resume is scored against those requirements; certifications remain in the plan and are trimmed only if space runs out.
3. **Optionally ask DeepSeek.** With an API key configured, DeepSeek receives the job description and the resume with phone, email, and link URLs removed. It returns a JSON plan containing bullet indices, project choices, skill selections, and a short summary. Every bullet, project, and skill choice is validated against the master resume, and the summary's numbers and technology terms are checked.
4. **Fit to two pages.** The selected content is rendered in the exact page layout, measured, and trimmed if necessary.
5. **Export.** Download a DOCX, print to PDF, or copy the plain text.

The AI is deliberately constrained by its prompt: it may select, reorder, and trim existing content, but not invent employers, dates, degrees, metrics, tools, or achievements. The app enforces those constraints on every bullet, project, and skill choice, and falls back to a local summary if the AI's summary adds an unknown number or technology term. If the AI call fails, the local plan is used instead.

## Use the app

After Pages is enabled and the workflow has run, the app is at **https://naveenmorla1901.github.io/resume_customizer/**.

1. On first run, choose **Import my resume** and select the original `.docx` (or **Use Naveen's starter resume**).
2. Open **Edit contact** and add the phone number, email, and links you want on the resume. The public starter ships with blank phone and email on purpose.
3. Paste the full job description, including the title, requirements, and preferred qualifications.
4. Leave **DeepSeek selection** on if an API key is saved; otherwise local tailoring runs.
5. Select **Tailor my resume**.
6. Review the match report, the changes list, and the live two-page preview.
7. Select **Download DOCX** for applications that accept Word files, or **Print / PDF** and choose *Save as PDF*.

For a PDF, use Letter paper, default margins, and 100% scale. Enable background graphics if your browser's preview drops the heading accents.

### Importing and exporting

- **Import `.docx`** extracts the resume's contact details, summary, experience, projects, skills, education, and certifications, then renders it with the built-in two-page template.
- **Import `.json`** restores a previous export.
- **Export JSON** saves a portable copy of the current master resume. Contact details are included, so keep the file private.
- **Reset to starter** restores the public starter content without contact details.
- **Clear all local data** removes the resume, plan, settings, API key, and saved job description from the browser.

A full private master copy can live in `master/naveen-morla.json`. The `master/` directory is gitignored and is never published.

## DeepSeek setup (optional)

Open **Settings → DeepSeek API** and enter a key from [platform.deepseek.com](https://platform.deepseek.com/api_keys). The defaults are:

| Setting | Value |
| --- | --- |
| Model | `deepseek-flash` |
| Endpoint | `https://api.deepseek.com/chat/completions` |
| Thinking | Disabled |
| Response format | JSON object |

Use **Test connection** to verify the key. Requests go directly from the browser to DeepSeek; no server proxies them. The key is stored only in this browser's `localStorage`.

Because the key is present in the browser, use a dedicated key with a spending limit, and avoid using the app on a shared computer. **Clear all local data** removes the key. If the browser or network blocks the request (CORS, offline, expired key, or insufficient balance), the app reports the error and you can retry or use local tailoring.

Without a key, everything except the DeepSeek selection step still works.

## Two-page behavior

The preview is the source of truth. The fitter reserves a safety margin to account for small browser-versus-Word layout differences. When page 1 overflows, it trims the summary, then reduces bullets from the oldest roles forward. When page 2 overflows, it trims project bullets, then whole projects, then skill items and groups, with certifications as a last resort.

The latest role is the last experience section to be reduced and is never dropped. If the content still cannot fit after every trim, the app keeps the result and shows a warning rather than silently cutting the remaining material.

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
    ├── demo-data.js        # Public starter resume and sample JD
    ├── store.js            # localStorage persistence
    ├── taxonomy.js         # Skill/keyword taxonomy
    ├── util.js
    └── vendor/             # docx, JSZip, licenses
master/
└── naveen-morla.json       # Local-only full master (gitignored)
```

## Privacy

- Resume data never leaves the browser unless **DeepSeek selection** is enabled and a request is made.
- When AI is enabled, the request contains the job description and the resume with phone, email, and link URLs removed; the name and link labels remain.
- The API key is sent only to the configured endpoint as a bearer token.
- There is no backend, account, cookie, or analytics.
- The public repository contains a starter resume. Do not commit a private master resume or an API key.

## Legacy FastAPI app

The repository still contains the earlier FastAPI + Supabase application in `app/`, `frontend/`, `requirements.txt`, and `docker-compose.yml`. It uses LaTeX/PDF generation, authentication, and server-side AI providers. It is not used by the static app.

Setup and troubleshooting for that version are in [SETUP.md](SETUP.md). The static app requires none of it.

## License

MIT. Vendored third-party licenses are in `docs/js/vendor/`.
