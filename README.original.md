# LUXCV

A premium, dark-luxury online resume builder. University semester project built with **HTML5, CSS3 and vanilla JavaScript only** - no frameworks, no jQuery, no backend, no database and no AI. It runs entirely in the browser.

## Run it

**Quickest:** double-click `index.html` (or drag it into Chrome, Edge, Firefox or Safari). Everything works from `file://`.

**Optional local server** (from inside the `luxcv/` folder):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Web fonts (Playfair Display and Inter) load from Google Fonts. Offline, the site falls back to Georgia and the system UI font and remains fully usable.

## Project structure

```
luxcv/
  index.html          Landing page
  templates.html      Template gallery
  builder.html        Resume editor: toolbar, form, preview placeholder
  css/
    variables.css     Design tokens: colour, type, spacing, shadows, radii, motion, widths
    base.css          Reset, element defaults, focus, skip link, reduced motion
    layout.css        Containers, sections, grids, header, hero, footer
    components.css    Buttons, nav, cards, FAQ accordion, resume mockup, panels
    templates.css     Template thumbnails and the A4 .resume-sheet base
    responsive.css    All breakpoints (480 / 640 / 768 / 1024 / 1280 / 1440)
    print.css         A4 print rules for PDF export
  js/
    data-model.js     Template catalogue (10 templates), resume data model v3, entry factories, migration
    dom.js            Safe DOM builder (textContent only), debounce
    dialog.js         Native <dialog> helpers + promise-based confirm
    editor-form.js    The editing form: sections, repeated entries, skills, photo, undo
    appearance.js     Template picker, accent colour and text-size controls
    sample-data.js    Fictional sample resume per template, used for previews
    storage.js        Failure-safe localStorage wrapper
    validation.js     Field validators + validateResume() (errors keyed by entry id)
    template-renderer.js  DOM-based, metadata-driven resume renderer + scaled, multi-page preview frames
    builder.js        Editor controller: draft load/autosave, toolbar, print, clear
    gallery.js        templates.html controller: filters, cards, preview modal, selection
    pdf-export.js     Print / "Save as PDF" through the browser print window (real text)
    pdf-download.js   "Download PDF": one-click image-based PDF (html2canvas + jsPDF)
    vendor/           html2canvas.min.js, jspdf.umd.min.js and their MIT licence files
    app.js            Shared UI behaviour + page bootstrap (loaded last)
  assets/
    icons/            logo-mark.svg, favicon.svg
```

## Conventions

- **One global.** Every script is a classic IIFE that attaches to `window.LuxCV` (`LuxCV.Data`, `LuxCV.Storage`, …). Classic scripts are used instead of ES modules so the site works when opened from `file://`.
- **Script order.** Each page loads only what it needs, with `defer`, and `app.js` always last. `app.js` starts the page controller named in `<body data-page="…">`.
- **Add a page.** Copy the header/footer from an existing page, set `data-page`, link the six core stylesheets (+ `print.css` with `media="print"`), and load `app.js` last.
- **Design tokens.** Never hard-code colours or spacing in components; use the variables in `css/variables.css`.
- **Content vs design.** Resume content lives in the data model and is separate from the template, so switching templates never loses text.
- **Progressive enhancement.** `<html>` gets a `js` class from a tiny inline script. Menu collapsing, FAQ collapsing and scroll reveal only apply when JavaScript runs.

## Design system

| Token | Value |
| --- | --- |
| Background | `#0B0B0D` |
| Secondary background | `#151519` |
| Elevated panels | `#1C1C22` |
| Gold accent | `#D4AF66` |
| Primary text | `#F5F1E8` |
| Secondary text | `#A7A7AE` |
| Headings | Playfair Display (Georgia fallback) |
| Interface | Inter (system UI fallback) |

## Testing the landing page

**Links and actions**
1. Open `index.html`. Click every header link: *Templates*, *Features* and *How It Works* scroll smoothly to their sections; *Create Resume* opens `builder.html`.
2. Click **Build My Resume** (hero, closing banner, footer) → `builder.html`. Click **Explore Templates** and **View all templates** → `templates.html`.
3. On `templates.html`, click **Use Template** on any card → `builder.html?template=…` shows that template's name and preview. Go back to the gallery: that card now shows a *Selected* tag.
4. Click each footer link, including *Back to top*.

**Responsive** - in browser dev tools, check 320, 375, 768, 1024, 1280 and 1440 px wide. There should be no horizontal scrollbar and no clipped text at any width. Below 768 px the header shows a menu button; from 768 px the links sit inline.

**Keyboard and accessibility**
- Press `Tab` from the top: the first stop is *Skip to main content*. Every interactive element shows a gold focus ring.
- Mobile menu: open with `Enter`/`Space`, close with `Escape` (focus returns to the button).
- FAQ: `Enter`/`Space` toggles an answer; `↑` `↓` `Home` `End` move between questions.

**Reduced motion** - enable "Reduce motion" in your OS settings: reveal animations, floating chips and smooth scrolling are switched off.

## Template system

Ten templates, all driven by one catalogue in `js/data-model.js`:

| id | Name | Layout |
| --- | --- | --- |
| `executive-gold` | Executive Gold | Single column, centred header, gold detailing |
| `modern-professional` | Modern Professional | Two column, full-height navy sidebar |
| `minimalist-white` | Minimalist White | Single column, section titles in a slim margin |
| `creative-portfolio` | Creative Portfolio | Two column, numbered sections, portfolio grid |
| `corporate-classic` | Corporate Classic | Single column, serif, ruled headings |
| `tech-specialist` | Tech Specialist | Single column, grouped technical skills, projects |
| `student-graduate` | Student & Graduate | Two column, education and coursework first |
| `elegant-serif` | Elegant Serif | Single column, editorial, drop-cap profile |
| `compact-ats` | Compact ATS-Friendly | Single column, plain and dense |
| `midnight-premium` | Midnight Premium | Dark two column; light version when printed |

**How rendering works.** `Renderer.build(resume, templateId, options)` reads the template's `sections.main` / `sections.side`, `headings` and `skillStyle` and builds, with DOM methods and `textContent` only, one shared structure (`.resume-sheet > .rs-header + .rs-body > .rs-main + .rs-aside`). `css/templates.css` gives each template its own look through `--rs-*` variables and per-template rules (`.resume--{id}`). `Renderer.createPreview()` wraps a real-size A4 sheet in a frame that scales it to any width, so previews are the actual design.

**Add a template.** (1) Add an entry to `TEMPLATES` in `data-model.js`. (2) Add a sample under the same id in `sample-data.js`. (3) Add a `.resume--{id}` block in `templates.css`. The gallery, filters, modal and builder pick it up automatically.

**Selection.** "Use Template" links go to `builder.html?template={id}` and also save the id in localStorage (`luxcv:prefs`). The builder reads the URL first, then storage, then the default, and writes the id back into the address bar. Part 1 ids (`aurelia`, `meridian`, `onyx`, …) still resolve to their closest current template.

**Data shape** (schema v4, see `createEmptyResume`): `settings` `{accent, fontSize}` (see Part 4), and `personal` `{fullName, jobTitle, email, phone, location, linkedin, website, photo}`, `summary`, and lists whose entries each carry a stable `id`: `experience[]` `{role, company, location, start, end, current, highlights[]}`, `education[]` `{degree, school, field, location, start, end, details, coursework[]}`, `skills[]` `{name, group}`, `projects[]` `{name, link, description, technologies[]}`, `certifications[]` `{name, issuer, date, url}`, `languages[]` `{name, level}`. Older saved drafts are cleaned and upgraded by `Data.migrateResume()`.

## Testing the template gallery

1. Open `templates.html`. Ten cards appear, each with a miniature of the real template, a name, description, **Preview** and **Use Template**.
2. **Filters:** click *Creative*, *Tech*, *ATS-friendly*… Cards hide or show, the status line updates ("Showing 3 of 10 templates · Creative") and the address bar gains `?category=creative`. Reload: the filter is kept. *All* restores everything.
3. **Preview modal:** click **Preview** (or click a miniature). The dialog opens with the full-size template and focus on the close button.
   - Close with the **X**, the **Close** button, the **Escape** key, or a click on the dark backdrop. Focus returns to that template's Preview button.
   - **Tab** and **Shift+Tab** stay inside the dialog; the page behind does not scroll.
   - **Previous / Next** step through the templates currently shown by the filter, wrapping round.
   - On *Midnight Premium*, **Show print version** switches the preview to the light print palette.
4. **Selection:** click **Use Template** on any card or in the modal. The builder opens at `builder.html?template={id}` showing the template's name and preview. Reload the builder, or open `builder.html` with no parameter: the choice is kept. Visit `builder.html?template=nonsense` and it falls back to your saved template.
5. **Responsive:** check 320, 375, 768, 1024, 1280 and 1440 px. Cards are one column on phones, two from 640 px and three from 1024 px. Below 640 px the modal fills the screen.

## Resume editor (Part 3)

`builder.html?template={id}` is a two-panel workspace. **Left:** nine collapsible form sections (personal information, photo, summary, experience, education, skills, projects, certifications, languages). **Right:** a live-preview placeholder showing the selected template with sample content (connected to your data in Part 4). The toolbar has *Back to Templates*, the template name, save status, **Save Draft**, **Preview** and **Print / Download**. Below 1024 px an **Edit / Preview** switch replaces the side-by-side layout.

- **Repeated entries** get stable ids (`exp-…`), so editing or removing one never touches another. Removing an entry shows **Undo** for ten seconds.
- **Validation** (`validation.js`): name and email are required; email, phone, URLs (http/https only; `javascript:`, `data:` etc. are refused), LinkedIn, dates (`Jun 2022`, `06/2022`, `2022`, or `Present`) and date order are checked. Entries you haven't started are ignored. Messages appear when you leave a field, clear as soon as the value is valid, and are linked with `aria-describedby`. Print / Download lists any problems in a summary with links to each field.
- **Safety:** all user text is inserted with `textContent`/`.value`; the renderer escapes everything. Entered HTML or script is shown as plain text.
- **Drafts** autosave to localStorage (`luxcv:resume`) and are restored on reload. **Clear entire resume** asks for confirmation first.
- **Print / Download** validates, then prints the real template through the browser's *Save as PDF*.
- **Scripts are classic scripts, not `type="module"`**, deliberately: ES modules are blocked on `file://` in most browsers, and the project must run by double-clicking `index.html`.

### Testing the editor
1. Open `builder.html`. Fill in a name and email; leave email blank and tab away to see the message; type `abc` and see the format message.
2. Open *Work experience* → **Add experience** three times, fill each, **Remove** the middle one (others are untouched), then **Undo**.
3. Skills: type a skill and press Enter or comma; paste `Go, Rust, Python`; add a duplicate to see the message; remove a chip with its ×.
4. Type `<img src=x onerror=alert(1)>` into any field, then **Preview**: it appears as literal text and nothing runs.
5. Reload: your draft returns. **Clear entire resume** → Cancel keeps it, confirm clears it.
6. **Print / Download** with an empty email: the error summary appears. Fix it and the print dialog opens with one A4 page.
7. Check 320 / 375 / 768 / 1024 / 1280 / 1440 px: no horizontal scroll; the Edit / Preview switch appears below 1024 px.

## Live preview and templates (Part 4)

The builder's right panel renders the **real template with your real data** and re-renders on the next animation frame after every keystroke, entry change, template change or appearance change.

- **Same data, ten designs.** Content (`resume`) and design (`templateId` + `settings`) are separate. The *Template* picker in the *Template & appearance* section switches the design instantly and never touches your content. The choice is saved with the draft and in `luxcv:prefs` and written to the address bar, so the gallery's *Selected* badge and a later visit to `builder.html` keep it.
- **Nothing silently disappears.** If a template doesn't list a section you filled in (for example Projects in *Executive Gold*), the section is placed after the nearest earlier one. Empty sections, headings, titles and separators are never drawn. Placeholders ("Your Name") appear only while the whole resume is empty; the panel then shows an empty-state card with a *Start with my name* button.
- **Appearance.** Eight curated accent colours that read well on white, a custom colour picker (with a contrast warning) and Small / Medium / Large text (92 % / 100 % / 108 %). Templates re-derive their tinted backgrounds from the accent. *Compact ATS-Friendly* stays black and white by design. *Midnight Premium* uses the accent on screen and a darkened shade in its light print version (*Show print version* toggles that view).
- **Photo.** Shown by every template except *Compact ATS-Friendly*. **Size limit:** you may choose a JPG/PNG/WebP up to 8 MB; it is cropped to a square, re-encoded as JPEG (360 px, falling back to smaller sizes and lower quality) and only stored if the result is at most 260,000 characters (about 190 KB). The original file is never stored. Anything larger is refused with a message.
- **Long resumes.** The preview grows, is rounded to whole A4 pages and shows dashed *Page N* guides. The label ("Fits on 1 page" / "About 3 pages") is an estimate; in testing it matched the printed PDF for all ten templates with the heavy sample, and was one page short for one template. When printing, page margins repeat on every page and sidebar colour bands run the full height of each page (Chromium, Edge and Firefox; Safari support for repeated margins may vary).
- **Safety.** The renderer never builds HTML from user text. Web addresses and emails become links only if `validation.js` accepts them (http/https and a valid `mailto:` only; `javascript:`, `data:`, `file:` and similar are never linked, even if they reach storage by other means). Links open with `rel="noopener noreferrer"`. Saved drafts are re-cleaned on load (types forced, unknown keys dropped, bad photo data removed).

### Testing Part 4
1. Open `builder.html`: the preview shows the empty-state card. Type a name: the sheet updates immediately; add a role, a skill, a project; remove and undo them.
2. In *Template & appearance* pick each template in turn. Your details stay; the URL, the toolbar tag and (after going back) the gallery badge follow.
3. Try an accent swatch, the custom colour and Small / Large text. Pick *Compact ATS-Friendly*: accent controls are disabled and the photo is hidden. Pick *Midnight Premium* and use *Show print version*.
4. Add a photo; add many roles until the preview shows *Page 2* guides, then *Print / Download* and check the PDF.
5. Type `<script>alert(1)</script>` or `javascript:alert(1)` as a website: it is shown (or rejected) as text and never runs or links.

## Local storage and PDF export (Part 5)

### Saving
- Everything is stored in the browser's `localStorage` under two keys: `luxcv:resume` (`{savedAt, rev, resume}`: content, chosen template and appearance settings, including the shrunk profile photo) and `luxcv:prefs` (template choice). Nothing is uploaded; there are no accounts, passwords or tokens.
- **Autosave** runs 700 ms after the last change, and when the tab is hidden or closed. **Save Draft** saves immediately and announces it.
- **Load Saved Resume** replaces the page with the saved copy after a confirmation (which warns when there are unsaved edits). Because autosave stores edits within a second, "unsaved edits" only exist for a moment, so the main use is picking up a copy saved from another tab.
- **Clear Resume** (confirmation) empties the editor and deletes the saved draft; the template choice stays. **Delete all saved data** (confirmation) also removes the saved template choice.
- **Newer-edit guard:** every write carries a revision (`rev`). A tab remembers the revision it loaded or saved; if the stored one differs (another tab or window saved or deleted it), nothing is written, autosave pauses and a notice offers "Load the saved version" or "Replace it with this page". Deleting in another tab is detected too, so the draft isn't silently recreated.
- **Failures** are reported in plain language, never silently: storage blocked/unavailable (private mode, blocked site data; editing still works), storage full (suggests removing the photo or saving a PDF), damaged JSON (ignored, with a button to delete it), and a draft with the wrong shape (cleaned by `Data.migrateResume`).
- **Photo:** persists with the draft. Limits: JPG/PNG/WebP up to 8 MB in, cropped square and re-encoded to a JPEG of at most 260,000 characters; the original is never stored. If storage is full the save fails with a message that mentions the photo.
- The page explains that storage is local to this browser and device and is not a secure or cloud backup.

### Print and PDF
- **Print Resume** and **Save as PDF** validate first, then mount the real template output into `#print-root` and call `window.print()`. `css/print.css` hides the toolbar, editor, notices and dialogs, uses A4 with no `@page` margin (each template has its own padding, repeated on every page), prints dark text on white (Midnight Premium uses its light print palette), keeps entries and headings together, and never scales the resume down to fit one page. Ctrl/Cmd+P prints the resume too (a `beforeprint` hook mounts it).
- **No PDF library is used.** The "Save as PDF" button opens the browser's print window after a short explanation; the PDF is created by the browser, keeps selectable text and is ATS-friendly. A script cannot tell whether the person saved or cancelled, so the app never says a file was downloaded: after the dialog closes it says only that the window closed.
- Paper is A4. On US Letter the page fits but has a thin extra margin; choose "Letter" in the print window if you prefer. Margins repeated on every page are verified in Chromium only.

### Testing Part 5
Open `builder.html` from disk or any static server. Check: type, wait a second, refresh (restored); open a second tab and edit there (the first tab shows the conflict notice and does not overwrite); set `localStorage.setItem('luxcv:resume','{bad')` and reload (notice, page still works); Clear and Delete all saved data (dialogs, storage emptied); print/Save as PDF for each of the ten templates (print preview shows only the resume).

## Download PDF (image) and Save as PDF (text)

The toolbar has two PDF buttons, and the print window is kept:

| Button | How it works | Text selectable? | Look |
| --- | --- | --- | --- |
| **Download PDF** | One click. The resume is drawn to a picture in the browser and packed into an A4 PDF that downloads immediately (`js/pdf-download.js`). | No: pages are images (larger file, not readable by applicant-tracking systems). | Very close to the preview. |
| **Save as PDF** | Opens the browser's print window; you choose "Save as PDF" there (`js/pdf-export.js`). | Yes | Exact. |

- **Libraries (both MIT, bundled in `js/vendor/`, with their licence files, loaded only when you first click Download PDF):** html2canvas 1.4.1 and jsPDF 2.5.2. They run entirely in the browser; nothing is uploaded and no internet is needed.
- Pages are cut between entries, never through a line of text, and later pages get top and bottom margins continued from the page background. Midnight Premium downloads in its light print palette. Validation (name and email) runs first, as for printing.
- The message after clicking says the browser "was asked to download" the file; a page cannot see whether you then kept or cancelled it.
- Limits: because pages are pictures, text can't be selected or searched and files are larger (about 50 KB for one page, 1 MB or more for long resumes); html2canvas draws a few details slightly differently from the browser (for example small tag boxes can sit a pixel or two off their text); the page count can differ from the print window by one on long resumes. For an applicant-tracking system, use **Save as PDF** or the Compact ATS-Friendly template.

## Final quality assurance (Part 6)

Checked with Playwright (headless Chromium, opened from `file://`) and axe-core 4 (WCAG 2.0/2.1 A and AA plus best practices):

- **Functional:** editor (all nine sections, add/remove/undo), validation, template switching with data preserved, accent and text size, photo upload limits, autosave and restore, Load/Clear/Delete, cross-tab conflict guard, damaged or blocked storage, quota errors, Print, Save as PDF and Download PDF flows.
- **Templates:** all ten render with minimal, full, sparse and very long data, with no raw HTML executed; the PDF page count matches the preview estimate for 19 of 20 test runs.
- **Responsive:** no horizontal scrolling at 320, 375, 768, 1024, 1280 and 1440 px on the landing page, gallery and builder.
- **Accessibility:** zero axe violations on the landing page, gallery, gallery modal, builder (including notices, error summary and every dialog) and the preview of every template. Fixes made in this pass: a label for the hidden photo file input, keyboard access to scrollable dialog bodies, and text contrast in the Minimalist White (muted grey) and Creative Portfolio (accent orange) templates.
- **Security and privacy:** no `eval`, `document.write` or user content in `innerHTML` (the gallery's only `innerHTML` use is escaped catalogue text); links are http/https only with `rel="noopener noreferrer"`; no network requests except the optional Google Fonts stylesheet (the site falls back to system fonts offline); no cookies, analytics, accounts or secrets; data is only in this browser's localStorage.
- **Print and PDF:** only the resume prints; A4; no forced shrink to one page; the browser's print window creates the text PDF. Download PDF was tested on all 10 templates with short, medium and very long data (1, 2 and 3-4 pages).

### Known limits
- The "N pages" label is an estimate; Minimalist White with the long sample prints one page more than the label says.
- Repeated page margins on multi-page prints are verified in Chromium; Firefox and Safari were not available for testing.
- The PDF is made by the browser's print window, so there is no one-click download and the app cannot know whether a file was saved.
- localStorage is per browser and device and is not a backup.
- Google Fonts need an internet connection; offline, fallback fonts are used.
- Automated tests cannot replace a manual pass with a screen reader, which was not done.

## Status

All six parts are complete.
