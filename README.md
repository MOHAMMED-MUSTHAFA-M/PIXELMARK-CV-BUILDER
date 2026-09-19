# PIXELMARK CV BUILDER

A client-side CV/Resume Builder and ATS Readiness tool for **PIXELMARK**.

## Architecture

This version is intentionally **backend-free** and uses mainly:

- HTML
- CSS
- JavaScript ES modules
- IndexedDB for local drafts/files/settings
- Browser APIs for printing, downloads and local persistence
- CDN-delivered browser ESM libraries only for PDF/DOCX generation

There is **no Node.js server, database server, API server, authentication server, or private API key** in this project.

## Files

```text
index.html          Application shell
styles.css          Complete application + CV styles
app.js              Main UI/application logic
data.js             Initial structured CV data
storage.js          IndexedDB storage layer
ai.js               Local rule-based smart assistance
ats.js              Local ATS analyzer + job matching
templates.js        CV template definitions
exporters.js        Browser PDF/DOCX exporters
PIXELMARKprime.png  PIXELMARK logo asset
favicon.svg         Favicon
manifest.webmanifest PWA manifest
sw.js               Offline service worker
SOURCE_CV.txt       Source CV reference notes
```

## GitHub Pages deployment

1. Create a GitHub repository.
2. Upload all files in this folder to the repository root.
3. Commit and push.
4. Open **Settings → Pages**.
5. Select **Deploy from a branch**.
6. Select the branch containing these files and the `/ (root)` folder.
7. Save.
8. Open the GitHub Pages URL.

Because this is a static application, there is no build command and no backend deployment step.

## Local testing

Do not rely on opening `index.html` directly with `file://` for the complete experience. Browser module, IndexedDB, service-worker and CDN behavior is more reliable from a local static server.

For example, with Python installed:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/`.

No `npm install` is required.

## Storage

Drafts, settings and recent-file metadata use IndexedDB in the user's browser. Data is local to that browser/device unless the user exports a backup.

## AI / Smart Assistance

The default smart-assistance layer is local and deterministic. It does not send CV data to an AI provider and does not require an API key.

It provides browser-side functions such as:

- keyword extraction
- action-verb detection
- repetition checks
- summary analysis
- bullet suggestions
- keyword matching

A future remote AI provider can be added through a secure backend/serverless proxy, but this static version does not require or include one.

## ATS analyzer

The **Pixelmark ATS Readiness Score** is a transparent rule-based estimate created by this application. It is not the score or algorithm of any commercial ATS vendor.

The analyzer checks document structure, contact information, headings, keywords, experience clarity, skills, education/certifications, and formatting risks.

## PDF / DOCX

PDF and DOCX generation run in the browser. The export modules load their open-source browser-compatible libraries from jsDelivr when export is requested.

The PDF exporter writes selectable/searchable text rather than embedding the CV as a screenshot.

DOCX export creates editable document text and structured headings/bullets.

If the browser is offline and the export libraries have not already been cached, export may require an internet connection. Editing, local drafts and local ATS tools remain client-side.

## Privacy

The application does not transmit CV information to a backend by default.

Do not put private API keys into this repository. GitHub Pages is static hosting and cannot safely hide frontend secrets.

## Authentication limitation

There is intentionally no fake cloud authentication. A static GitHub Pages site cannot securely provide multi-device account authentication or a private server database by itself.

If cloud accounts are required later, add a real authentication/database provider behind a secure architecture.

## Customization

- Change PIXELMARK colors in `styles.css`.
- Replace `PIXELMARKprime.png` with another logo while keeping the same filename, or update the image path in `app.js`.
- Edit initial CV content in `data.js`.
- Add or modify templates in `templates.js` and the CV rendering logic in `app.js`.
- Add local analysis rules in `ai.js` and `ats.js`.
