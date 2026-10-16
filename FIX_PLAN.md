# ExpoPreview fix plan

Status: phase 1 implemented with unit/integration and Chromium workflow checks.
Phases 2–6 remain open; this is not release-ready. Existing working-tree changes
were preserved. Unrelated line-ending changes are excluded from the phase 1
implementation commit.

Phase 1 evidence (8 October 2026): `npm test` covers validation, stock/custom
round-trips, synthetic v1 migration, same-key undo after replacement, dirty
project/custom definitions, cancellation and recovery. `npm run build` passes.
`tests/browser/document.cjs` covers menu/shortcut Open, Save/Discard/Cancel,
New, file drop/Escape, previous-layout recovery and invalid-file protection.
Recovery is currently an in-memory snapshot, not a durable archive. Genuine v1
fixtures and broader browser coverage remain outstanding. A restoration guard
also prevents stale callbacks from replacing edits or surviving effect cleanup;
the remaining phase 2 persistence work is still required.

This plan addresses the 18 findings from the pre-production review on 8 October
2026. Finding numbers below refer to that review. Preserve existing working-tree
changes and implement each phase as a separate, reviewable change.

## Priorities and release gate

Fix document loss and invalid imports first, followed by placement correctness
and the PDF/artwork pipeline. Add regression tests alongside each fix; a passing
build alone is not sufficient validation.

Before real client use, complete phases 1–5 and the desktop checks in phase 6.
For small windows, either implement a usable layout or display and document an
explicit minimum-size requirement. Do not claim mobile support without testing it.

## Phase 1 — Safe document imports and replacement

Addresses findings 1, 2 and 10.

Files: `src/state/persistence.js`, `src/state/actions.js`, `src/state/store.js`,
`src/App.jsx`, `src/ui/TopBar.jsx`, and the new regression-test setup.

- Add document validation after version migration/default filling and before
  changing live state. Validate object/array shapes, known stand and scene enums,
  finite bounded dimensions and coordinates, supported item types and variants,
  unique item IDs, custom definitions, project strings, and graphic value types.
- Establish documented file-size, item-count, text-length and artwork limits.
  Reject oversized files before reading their entire contents where possible.
- Distinguish missing optional fields from invalid supplied values. Preserve
  supported v1 migration; reject unknown versions with a useful message.
- Route menu, shortcut, drop and New actions through one replacement workflow.
  Track unsaved changes, including project settings and custom definitions on
  otherwise empty stands. Offer Save / Discard / Cancel; explain that browser
  downloads cannot confirm that a user retained a durable backup.
- Keep a recovery snapshot before replacement. Invalid files must never replace
  the current document. Add a recoverable UI error boundary as a final safeguard.
- Reset undo coalescing and transient interaction state on document replacement.

Acceptance and tests:

- Invalid stand types, null/wrong-type fields, duplicate IDs, unknown items,
  non-finite or out-of-range numbers, malformed JSON and oversized inputs fail
  without changing the current document or its history.
- Valid stock/custom layouts round-trip with and without artwork. Add genuine
  v1 fixtures when available; label synthetic fixtures accurately.
- Opening or creating a document protects dirty work through every entry point.
- The first edit after loading is undoable, including an immediate edit using
  the same merge key as the previous document.

## Phase 2 — Reliable autosave and recovery

Addresses findings 3, 4 and 5.

Files: `src/App.jsx`, `src/state/persistence.js`, `src/state/store.js`, and save
status/recovery UI.

- Introduce an explicit restoration lifecycle. Prevent a pending restoration
  from overwriting edits, file opens or New actions; cancel stale callbacks on
  cleanup, including React StrictMode effect remounts.
- Return meaningful persistence results. Show restoring, unsaved, saving, saved
  and failed states; keep failed writes eligible for retry and manual export.
- Serialize writes or use revision checks so an older write cannot become the
  latest saved document. Close IndexedDB connections and handle transaction
  completion, errors and aborts.
- Store recovery data by document and editing session, rather than one global
  autosave key. Migrate the existing autosave without deleting the only copy.
- Detect concurrent editing using document/session revisions and cross-tab
  communication. Preserve conflicting versions and offer recovery; do not
  silently choose the latest writer.
- Reduce the debounce-loss window and attempt saves on visibility changes.
  Warn about pending/failed saves before leaving where browsers permit it.
  Do not rely on asynchronous IndexedDB writes completing during unload.
- Retain a last-known-good recovery version and document autosave's limits.

Acceptance and tests:

- Delayed restoration cannot overwrite a new edit or an explicitly opened file.
- A rapid edit/reload either restores the edit or gives a clear pending-save
  warning before navigation; no misleading saved indicator is shown.
- Blocked storage, quota errors, aborted transactions and failed writes produce
  visible feedback and leave the document usable and exportable.
- Two tabs editing different documents retain both. Concurrent edits to the
  same document preserve recovery versions and expose the conflict.

## Phase 3 — Correct placement and physical boundaries

Addresses findings 6, 7, 8 and 9.

Files: `src/ui/Catalogue.jsx`, `src/scene/Viewport.jsx`,
`src/scene/PlacedItem.jsx`, `src/state/store.js`, `src/catalog/items.js`,
`src/catalog/shapes.js`, and affected models/plan rendering.

- Use an explicit click-versus-drag lifecycle. Register release handling before
  it can be missed; handle pointer cancellation, lost capture, Escape and window
  blur. Clear placement after click-to-add and restore camera controls.
- Centralize position constraints for dragging, nudging, numeric edits,
  duplication, rotation and item resizing. Recheck items when the stand shrinks
  or containment is enabled.
- Separate physical footprint from printable dimensions. Include feet, bases
  and worktop overhangs in containment, placement searches and floor plans.
  Preserve correct print-area measurements.
- Define behavior for items larger than the stand: visibly mark the conflict
  and require an explicit resolution rather than implying successful containment.
- Return a no-space result from automatic placement instead of stacking an item
  at the centre. Explain the failure and allow deliberate manual placement.

Acceptance and tests:

- A catalogue click adds exactly one item, leaves no ghost and enables orbiting.
  Drag release/cancellation works inside and outside the viewport.
- With containment enabled, all editing paths keep the full physical footprint
  within bounds or report an explicit oversized-item conflict.
- Cover each stock item, custom boxes, rotations, stand resizing and grid sizes.
  Specifically reproduce the Pixlip's former 125 mm rear-foot overhang.
- A full 1 × 1 m stand does not silently receive overlapping auto-placed counters.

## Phase 4 — Dependencies, compatibility and artwork lifecycle

Addresses findings 11, 14, 15, 16 and 17.

Files: `package.json`, `package-lock.json`, `vite.config.js`,
`src/utils/files.js`, `src/scene/useGraphicTexture.js`,
`src/ui/Inspector.jsx`, `src/ui/ExportDialog.jsx`, `src/export/pdf.js`,
`index.html`, and `README.md` as needed.

- Re-run the dependency audit at implementation time. Upgrade PDF.js, jsPDF and
  the Vite toolchain to supported patched versions, checking migration guidance
  and Node/browser requirements. Avoid an unreviewed `npm audit fix --force`.
- Record advisory applicability: an affected package version does not establish
  an exploitable app path. Review PDF scripting configuration and apply a
  compatible Content Security Policy where practical.
- Declare the supported Node and browser baseline. Test PDF.js worker loading
  in development and production; provide a useful unsupported-browser message
  or a tested compatibility build.
- Destroy PDF loading tasks/documents in `finally`, including failed, cancelled
  and password-protected conversions. Bound concurrent conversions.
- Add reference counting or bounded eviction for cached base textures and dispose
  unused resources. Ensure sharing/duplication does not dispose active textures.
- Track artwork decoding/loading/errors. Validate imported graphics and define
  an allowed URL policy for self-contained scene files. Surface broken artwork
  in the inspector and checklist; do not equate a nonempty URL with usable art.
- Wait for requested artwork to be ready before export, or clearly identify
  failures. Prevent an older asynchronous upload from overwriting a newer choice.
- Catch logo conversion failures and provide feedback consistent with artwork
  uploads. Surface branding-persistence failures when they affect the user.

Acceptance and tests:

- Valid images and multipage PDFs convert successfully on supported browsers;
  only PDF page 1 is used. Malformed, empty, password-protected and oversized
  files produce useful failures without wedging the UI.
- Repeated successful and failed conversions release workers. Replacing/removing
  artwork and opening another layout release unused cache entries.
- Broken artwork is marked invalid, not supplied; exports do not silently omit
  pending artwork. Rapid replacement preserves the last user choice.
- Standard/high PDF and PNG exports pass after upgrades. Capture the final audit
  results and explain any residual advisories and their reachable conditions.

## Phase 5 — Complete, legible PDF presentations

Addresses findings 12 and 13; completes the export work in phase 4.

Files: `src/export/pdf.js`, font assets and export regression fixtures.

- Embed appropriately licensed fonts for the supported scripts, with an explicit
  fallback strategy for unsupported characters and emoji. Recalculate wrapping
  and layout with the embedded fonts.
- Paginate the floor-plan key or create a complete numbered schedule. Every
  numbered object must have a corresponding entry, regardless of item count.
- Check long project/client/company names, custom item names and notes for
  clipping, overlap and silent truncation. Paginate or identify omitted content.
- Retain consistent item numbering across plan, key and artwork checklist.

Acceptance and tests:

- Inspect and extract text from A4/A3 PDFs containing accented Latin text,
  Japanese text, long names and the chosen unsupported-character fallback.
- Export 0, 1, 15, 16 and 20+ items; every plan number appears in the key/schedule.
- Cover optional sections, multiple artwork pages, custom items, branding and
  selected/current views. Verify actual rendered output as well as page counts.

## Phase 6 — Usable window sizes and release verification

Addresses finding 18 and documentation/coverage gaps from the review.

Files: `src/styles.css`, panel UI, `README.md`, test configuration and fixtures.

- Collapse side panels or provide a panel switcher below the supported desktop
  width. If smaller windows remain unsupported, show a clear minimum-size
  message instead of a zero-width editor.
- Update README/help claims to match implemented behavior: browser requirements,
  autosave limitations and conflicts, import limits, physical footprints,
  no-space placement, complete exports and artwork error states.
- Add unit/integration tests for document validation, state/history, constraints
  and persistence; browser tests for pointer lifecycle, file workflows,
  restoration, tab conflicts and exports. Use fixtures reproducing the findings.
- Add documented test commands and a CI build/regression check. Keep generated
  output and test browser profiles out of version control.
- Verify supplier print-area/component specifications before treating the bill
  of materials as production instructions; document any unverified estimates.

Release checklist:

- [ ] Clean locked dependency installation and production build pass.
- [ ] Regression tests for every reproduced data-loss and placement bug pass.
- [ ] Supported browsers pass image/PDF import and PDF/PNG export checks.
- [ ] Offline HDRI fallback works; external-resource failures remain recoverable.
- [ ] Autosave failure, rapid navigation and concurrent-tab checks pass.
- [ ] v2 round-trips and available genuine v1 fixtures pass.
- [ ] A4/A3 exports preserve readable text, complete keys and accurate art status.
- [ ] Supported window sizes retain usable viewport and controls.
- [ ] Audit results, compatibility baseline and remaining limitations are recorded.

## Review evidence and limitations

The original review used Node 22.23.3 and Chromium 130.0.6723.31. The production
build passed; no repository test suite existed. PDF export and three selected
3600 × 2400 PNG downloads succeeded. Invalid imports, destructive Open behavior,
autosave races/conflicts, placement defects, Unicode corruption, incomplete plan
keys, broken-artwork status and PDF worker retention were reproduced.

The review scripts and generated PDFs were placed under `/tmp/expo-review-browser`
and `/tmp/expo-review-*.pdf`; these are temporary evidence, not durable fixtures.
Recreate minimal regression fixtures in the repository during implementation.
Security exploitability, genuine v1 compatibility, supplier specifications,
current-browser coverage and extreme rendering/resource exhaustion were not
established by the review.
