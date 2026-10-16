# ExpoPreview

Lay out an exhibition stand in 3D with the stock catalogue, apply client artwork, and export a mockup PDF to send.

Use it online at **<https://mylandurray.github.io/ExpoPreview/>**. Every push to `main` rebuilds the site (`.github/workflows/pages.yml`).

```bash
npm install
npm run dev        # http://localhost:5173
```

> On Windows, run npm from Command Prompt or Git Bash. PowerShell blocks npm scripts unless the execution policy has been changed.

## What it does

| Area | Details |
|---|---|
| **Stand** | Width × depth, stand type (Island / Peninsula / Corner / Inline adds shell-scheme walls), wall height, carpet and wall colours |
| **Catalogue** | Pixlip lightbox (1–4 m), Backdrop, Pull-up banner, Counter, Curved counter, Branded drum table, plus custom box items saved with the layout |
| **Placing** | Drag from the catalogue, or click to drop at the next free spot (walls and lightboxes go to the back, everything else to the front) |
| **Editing** | Drag to move, snap to 10/25/50/100 cm, keep-inside-stand clamping, 15° rotation slider, numeric position, duplicate, undo/redo |
| **Artwork** | Image or PDF (page 1) per surface. Upload in the inspector or drop a file straight onto an item in the 3D view. Cropped to fill, and the visible print size in mm is shown |
| **Views** | Perspective, Front, Left, Right and Top presets that frame the whole stand. Walls between the camera and the stand are cut away automatically |
| **Export** | PDF presentation (cover with project details, one page per view, dimensioned floor plan with numbered key, artwork checklist, optional bill of materials) or PNG images up to 3600 × 2400. Company name and logo are remembered per browser |
| **Help** | In-app guide (top bar `?` button) covering every feature, with search and a full shortcut list |
| **Files** | `.exposcene` save/open (with or without artwork). v1 files from the original app open unchanged. The current layout autosaves to IndexedDB and is restored on reload |

## Shortcuts

| | |
|---|---|
| Rotate 45° | `R` / `Shift+R` |
| Nudge | Arrow keys (one grid step; `Shift` = 1 cm) |
| Duplicate / Delete | `Ctrl+D` / `Delete` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Camera presets | `1`–`5` |
| Save / Open / Export | `Ctrl+S` / `Ctrl+O` / `Ctrl+E` |
| Help & all shortcuts | `?` |

## Structure

```
src/
├── App.jsx                 Layout, keyboard shortcuts, autosave, file drops
├── catalog/
│   ├── items.js            Stock catalogue, graphic sizes, footprints, bill of materials
│   └── shapes.js           Plan outlines (rect, circle, kidney) and geometry helpers
├── state/
│   ├── store.js            Zustand store: document + undo history + UI state
│   ├── persistence.js      .exposcene read/write, v1 migration, IndexedDB autosave
│   └── actions.js          Open/save/snapshot actions shared by menus and shortcuts
├── scene/
│   ├── Viewport.jsx        Canvas, lighting, camera presets, drag handling
│   ├── Stand.jsx           Carpet, hall floor, shell walls, grid, dimension labels
│   ├── PlacedItem.jsx      One placed item: model, selection outline, pointer handling
│   ├── models.jsx          3D model per item type
│   ├── views.js            Camera framing, wall cutaway
│   └── viewportApi.js      Off-screen rendering for exports; picking items under the cursor
├── export/pdf.js           Client mockup PDF (jsPDF, lazy-loaded)
├── ui/                     Top bar, catalogue, inspector, export dialog, help guide, overlays
└── utils/files.js          Image/PDF → texture data URL (downscaled to 3072 px)
```

### Coordinates

Y is up and the floor is y = 0. The aisle (front of the stand) is +Z, and every model is built with its printable front facing +Z. Rotation is stored in degrees about Y.

### Adding a stock item

1. Add an entry to `CATALOG` in `src/catalog/items.js`: dimensions, `surfaces`, a `graphicSize` function, and an `outline` if the footprint isn't rectangular.
2. Add a model component in `src/scene/models.jsx` and register it in `MODELS`.
3. Optionally add a glyph in `src/ui/controls.jsx`.

The catalogue, inspector, floor plan, artwork checklist and bill of materials all pick the new item up automatically.

### Document safety and regression checks

Layout imports accept versions 1 and 2. Supplied invalid values are rejected
before changing the editor. Limits: 64 MiB per scene file, 500 placed items,
100 custom definitions, 10,000 characters per project field, 200 per custom
label, and 16 MiB of encoded artwork per face (64 MiB total). Stand width/depth
are 1–40 m, wall height 1–6 m, custom dimensions 0.01–40 m, and item coordinates
−100–100 m. Imported artwork must be embedded PNG, JPEG or WebP data URLs;
remote URLs are rejected. Artwork decoding checks are still pending.

Open (including Ctrl/Cmd+O and file drops) and New protect changes to the whole
document with Save / Discard / Cancel. Save downloads a file; the browser cannot
confirm you kept a durable backup. “Save without artwork” does not mark artwork
as backed up. File → Recover previous layout restores the snapshot taken before
the last replacement. This snapshot lasts only for the current page session and
is replaced on the next replacement; it is not a durable recovery archive.
Autosave reliability and cross-tab conflict handling remain under development.

Run `npm test` for document validation, synthetic v1 migration, replacement and
history regressions, and `npm run build` for the production build. Genuine v1
supplier/user fixtures are not yet available. Browser workflow tests are in
`tests/browser/document.cjs`; with a running dev server and Playwright plus its
Chromium installed, run `npm run test:browser`. Optional environment variables:
`BASE_URL`, `PLAYWRIGHT_MODULE` (absolute module path when installed separately),
and `CHROMIUM_EXECUTABLE` (existing Chromium executable).
