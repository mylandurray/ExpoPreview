import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  X, Search, Rocket, LayoutGrid, Package, Move3d, ImagePlus, Video, Send, Save, Keyboard, Lightbulb,
} from 'lucide-react'
import { useStore } from '../state/store'
import { MOD } from '../state/actions'

// ─── Content ──────────────────────────────────────────────────────────────────
// Plain strings so the whole guide can be searched. Inline markup:
// **bold** and [[key]] for a keyboard key.

export const HELP_TOPICS = [
  {
    key: 'start',
    label: 'Getting started',
    icon: Rocket,
    intro: 'ExpoPreview lets you lay out an exhibition stand in 3D, dress it with client artwork, and send a polished mockup PDF.',
    sections: [
      {
        title: 'The workspace',
        points: [
          '**Catalogue** (left): stock items to place on the stand, plus any custom items you create.',
          '**3D view** (centre): the stand itself. Orbit, pan and zoom around it, and drag items to arrange them.',
          '**Inspector** (right): stand settings when nothing is selected, or the selected item’s position, artwork and finish.',
          '**Top bar**: project name, File menu, undo/redo, help, light/dark mode and **Export mockup**.',
        ],
      },
      {
        title: 'A typical workflow',
        steps: [
          'Set the stand width, depth and type in the inspector (click empty floor to deselect everything first).',
          'Drag items from the catalogue onto the floor, or click one to drop it at the next free spot.',
          'Arrange items by dragging them; fine-tune with the arrow keys or the numeric position fields.',
          'Select an item and upload artwork for each printable surface — or drop an image straight onto it.',
          'Check the camera presets, then **Export mockup** to create a PDF or PNG images for the client.',
          'Save the layout as an **.exposcene** file so you can reopen or share it later.',
        ],
      },
    ],
    tip: 'Your layout autosaves in this browser and is restored when you come back, but save a file for anything you want to keep.',
  },
  {
    key: 'stand',
    label: 'Stand & scene',
    icon: LayoutGrid,
    intro: 'With nothing selected, the inspector shows settings for the stand and its surroundings.',
    sections: [
      {
        title: 'Stand',
        points: [
          '**Width and depth** are in metres (1–40 m). The floor area is shown underneath.',
          '**Stand type** adds shell-scheme walls: **Island** is open on all sides, **Peninsula** has a back wall, **Corner** has back and one side, **Inline** has back and both sides.',
          '**Wall height** and **wall colour** appear when the stand type has walls.',
          '**Floor** sets the carpet colour.',
        ],
      },
      {
        title: 'Surroundings',
        points: [
          '**Studio** uses a plain backdrop colour — best for clean client mockups.',
          '**Environment** uses a photographic backdrop (warehouse, lobby, city…) for more realistic lighting. These load from the internet.',
          '**Hall floor** shows the exhibition hall floor around the stand, with its own colour.',
        ],
      },
      {
        title: 'Editing preferences',
        points: [
          '**Snap to grid** rounds positions to 10, 25, 50 or 100 cm while dragging.',
          '**Keep items on the stand** stops items being dragged, rotated or resized past the stand edge.',
          '**Show dimensions** toggles the width/depth labels around the stand.',
        ],
      },
    ],
  },
  {
    key: 'catalogue',
    label: 'Catalogue & placing',
    icon: Package,
    intro: 'The catalogue lists everything you can put on the stand.',
    sections: [
      {
        title: 'Stock items',
        points: [
          '**Pixlip Lightbox**: backlit, double-sided SEG frame in 1, 2, 3 or 4 m widths — pick a size chip to add that width directly.',
          '**Backdrop**: double-sided fabric wall.',
          '**Pull-up Banner**: single-sided roll-up banner.',
          '**Counter** and **Curved Counter**: branded fronts; the curved counter wraps one graphic around its kidney shape.',
          '**Branded Drum Table**: poseur table with a wrapped pillar graphic.',
        ],
      },
      {
        title: 'Adding items',
        points: [
          '**Drag** a card onto the floor to place it exactly where you let go. A ghost shows where it will land.',
          '**Click** a card to drop it at the next free spot: walls and lightboxes go along the back, everything else near the front.',
          'Press [[Esc]] while dragging to cancel.',
        ],
      },
      {
        title: 'Custom items',
        points: [
          'Use **New custom item** to add a simple box with your own name, size and colour — handy for plinths, screens or furniture not in the catalogue.',
          'Turn on **Backlit** to render it evenly lit like a lightbox.',
          'Custom items are saved with the layout. Removing one from the catalogue also removes any placed copies.',
        ],
      },
    ],
  },
  {
    key: 'editing',
    label: 'Moving & editing',
    icon: Move3d,
    intro: 'Click any item in the 3D view to select it. The inspector switches to that item.',
    sections: [
      {
        title: 'Position and rotation',
        points: [
          '**Drag** an item across the floor to move it. Snapping and edge limits follow your editing preferences.',
          '**Arrow keys** nudge by one grid step (10 cm with snapping off). Hold [[Shift]] for 1 cm steps.',
          '[[R]] rotates 45° clockwise, [[Shift]]+[[R]] anticlockwise. The inspector slider rotates in 15° steps.',
          'Type exact **Across (X)** and **Depth (Z)** values in metres from the stand centre. Positive Z is towards the aisle.',
        ],
      },
      {
        title: 'Item settings',
        points: [
          '**Frame width** switches a lightbox between 1–4 m without re-placing it.',
          '**Finish** (or **Fabric colour** on lightboxes) colours printable surfaces that don’t have artwork yet.',
          '**Duplicate** places a copy right beside the original; **Delete** removes it.',
        ],
      },
      {
        title: 'Undo and history',
        points: [
          `Undo with [[${MOD}+Z]] and redo with [[${MOD}+Shift+Z]] (or the arrows in the top bar).`,
          'Rapid changes like dragging a slider are grouped into a single undo step.',
        ],
      },
    ],
  },
  {
    key: 'artwork',
    label: 'Artwork',
    icon: ImagePlus,
    intro: 'Each printable surface can carry its own artwork. Double-sided items have separate front and back slots.',
    sections: [
      {
        title: 'Adding artwork',
        points: [
          'Select an item and click **Upload** on a surface in the inspector, or drag a file onto the slot.',
          'Or drop an image **straight onto an item in the 3D view** — it goes on whichever side you dropped it on.',
          'Accepted files: PNG, JPG, WebP, or a PDF (the first page is used).',
          'On double-sided items, **Use front on back** copies the front artwork to the back in one click.',
        ],
      },
      {
        title: 'Sizing',
        points: [
          'The size under each slot is the **visible print area** in millimetres — use it to brief the designer.',
          'Artwork is **cropped to fill** the surface, so match the aspect ratio to avoid losing edges.',
          'Large images are downscaled to 3072 px for performance; the preview stays sharp at mockup sizes.',
        ],
      },
    ],
    tip: 'The Materials tab shows how many surfaces have artwork, so you can spot anything still missing before exporting.',
  },
  {
    key: 'views',
    label: 'Camera & views',
    icon: Video,
    intro: 'Move around the stand freely or jump to a preset that frames everything.',
    sections: [
      {
        title: 'Moving the camera',
        points: [
          '**Orbit**: left-drag on empty space.',
          '**Pan**: right-drag.',
          '**Zoom**: scroll wheel or trackpad pinch.',
        ],
      },
      {
        title: 'Preset views',
        points: [
          'Use the bar at the bottom of the view, or press [[1]]–[[5]]: **Perspective**, **Front**, **Left**, **Right** and **Top**.',
          'Presets reframe automatically to fit the stand and everything on it.',
          'Walls between the camera and the stand are cut away so you can always see inside.',
          '**Snapshot** saves the current view as an image.',
        ],
      },
    ],
  },
  {
    key: 'export',
    label: 'Exporting',
    icon: Send,
    intro: `Click **Export mockup** (or press [[${MOD}+E]]) to create something to send to the client.`,
    sections: [
      {
        title: 'PDF presentation',
        points: [
          'A **cover page** with the project name, client and your company details and logo.',
          'One page per **view** you pick — including **Your view**, the camera angle you’re looking at right now.',
          'Optional **floor plan**: dimensioned top-down plan with a numbered key.',
          'Optional **artwork checklist**: print sizes per surface and what’s been supplied.',
          'Optional **bill of materials**: frame components — usually for internal use.',
          'Choose **A4 or A3** paper and **Standard or High** quality.',
        ],
      },
      {
        title: 'PNG images',
        points: [
          'Exports each chosen view as a separate image at 2400 × 1600 or 3600 × 2400.',
        ],
      },
    ],
    tip: 'Your company name and logo are remembered in this browser, so you only enter them once.',
  },
  {
    key: 'files',
    label: 'Saving & files',
    icon: Save,
    intro: 'Layouts are saved as .exposcene files you can reopen, archive or send to a colleague.',
    sections: [
      {
        title: 'File menu',
        points: [
          `**Save layout** ([[${MOD}+S]]) saves everything, including artwork.`,
          '**Save without artwork** makes a much smaller file — useful for sharing a layout draft.',
          `**Open…** ([[${MOD}+O]]) loads a saved layout. You can also drop an .exposcene file onto the 3D view.`,
          '**New layout** starts from a blank stand.',
          'Files from the original version of ExpoPreview open unchanged.',
        ],
      },
      {
        title: 'Autosave',
        points: [
          'The current layout is saved in this browser as you work and restored when you reopen the app.',
          'Autosave is per browser and device — clearing site data removes it. Save a file for anything important.',
        ],
      },
      {
        title: 'Materials tab',
        points: [
          'Lists every item on the stand with quantities, an artwork progress count, and the frame components each Pixlip lightbox needs.',
        ],
      },
    ],
  },
  {
    key: 'shortcuts',
    label: 'Keyboard shortcuts',
    icon: Keyboard,
    intro: 'Press [[?]] at any time to open this list.',
    shortcuts: [
      ['Camera', [
        ['Orbit', 'Left-drag empty space'],
        ['Pan', 'Right-drag'],
        ['Zoom', 'Scroll'],
        ['Preset views', '[[1]] – [[5]]'],
      ]],
      ['Items', [
        ['Add', 'Drag or click in catalogue'],
        ['Move', 'Drag item'],
        ['Nudge', 'Arrow keys ([[Shift]] = 1 cm)'],
        ['Rotate 45°', '[[R]] / [[Shift+R]]'],
        ['Duplicate', `[[${MOD}+D]]`],
        ['Delete', '[[Delete]] / [[Backspace]]'],
        ['Deselect / cancel', '[[Esc]]'],
        ['Add artwork', 'Drop an image onto an item'],
      ]],
      ['Layout', [
        ['Undo / Redo', `[[${MOD}+Z]] / [[${MOD}+Shift+Z]]`],
        ['Save', `[[${MOD}+S]]`],
        ['Open', `[[${MOD}+O]]`],
        ['Export mockup', `[[${MOD}+E]]`],
        ['Help', '[[?]]'],
      ]],
    ],
  },
]

const BY_KEY = Object.fromEntries(HELP_TOPICS.map((t) => [t.key, t]))

// ─── Rendering helpers ────────────────────────────────────────────────────────

function Rich({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g)
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('[[')) return <kbd key={i} className="kbd">{p.slice(2, -2)}</kbd>
    return <Fragment key={i}>{p}</Fragment>
  })
}

const plain = (s) => s.replace(/\*\*|\[\[|\]\]/g, '')

// Search results: every section (or shortcut row) whose text matches.
function search(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits = []
  for (const topic of HELP_TOPICS) {
    for (const s of topic.sections ?? []) {
      const lines = [...(s.points ?? []), ...(s.steps ?? [])].filter((l) => plain(l).toLowerCase().includes(q))
      if (lines.length || s.title.toLowerCase().includes(q)) {
        hits.push({ topic, title: s.title, lines: lines.length ? lines : (s.points ?? s.steps).slice(0, 2) })
      }
    }
    for (const [group, rows] of topic.shortcuts ?? []) {
      const lines = rows.filter((r) => plain(r.join(' ')).toLowerCase().includes(q)).map(([a, b]) => `**${a}**: ${b}`)
      if (lines.length) hits.push({ topic, title: group, lines })
    }
  }
  return hits
}

function TopicBody({ topic }) {
  return (
    <article className="help-article">
      <h3>{topic.label}</h3>
      <p className="help-intro"><Rich text={topic.intro} /></p>

      {topic.sections?.map((s) => (
        <section key={s.title} className="help-section">
          <h4>{s.title}</h4>
          {s.steps ? (
            <ol className="help-steps">{s.steps.map((l) => <li key={l}><Rich text={l} /></li>)}</ol>
          ) : (
            <ul className="help-points">{s.points.map((l) => <li key={l}><Rich text={l} /></li>)}</ul>
          )}
        </section>
      ))}

      {topic.shortcuts?.map(([group, rows]) => (
        <section key={group} className="help-section">
          <h4>{group}</h4>
          {rows.map(([what, how]) => (
            <div className="bom-row" key={what}>
              <span className="bom-sub">{what}</span>
              <span className="help-keys"><Rich text={how} /></span>
            </div>
          ))}
        </section>
      ))}

      {topic.tip && (
        <div className="help-tip">
          <Lightbulb size={16} />
          <span><Rich text={topic.tip} /></span>
        </div>
      )}
    </article>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

export default function HelpDialog() {
  const open = useStore((s) => s.helpOpen)
  const topicKey = useStore((s) => s.helpTopic)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const [query, setQuery] = useState('')
  const body = useRef()
  const close = () => setHelpOpen(false)
  const go = (key) => { setQuery(''); setHelpOpen(true, key) }

  useEffect(() => { if (open) setQuery('') }, [open])
  useEffect(() => { body.current?.scrollTo(0, 0) }, [topicKey, query])

  const results = useMemo(() => search(query), [query])
  if (!open) return null
  const topic = BY_KEY[topicKey] ?? HELP_TOPICS[0]
  const index = HELP_TOPICS.indexOf(topic)
  const next = HELP_TOPICS[index + 1]

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="modal-head">
          <div>
            <h2 id="help-title">Help &amp; guide</h2>
            <p>How ExpoPreview works, from first item to finished mockup.</p>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="help-layout">
          <nav className="help-nav" aria-label="Help topics">
            <label className="help-search">
              <Search size={14} />
              <input
                type="search"
                placeholder="Search help"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); query ? setQuery('') : close() } }}
                aria-label="Search help"
              />
            </label>
            {HELP_TOPICS.map((t) => {
              const Icon = t.icon
              const on = !query && t.key === topic.key
              return (
                <button key={t.key} className={`help-nav-item${on ? ' on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => go(t.key)}>
                  <Icon size={15} /> {t.label}
                </button>
              )
            })}
          </nav>

          <div className="help-body" ref={body}>
            {query ? (
              results.length ? (
                <div className="help-results">
                  <div className="hint">{results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”</div>
                  {results.map((r, i) => (
                    <button key={i} className="help-result" onClick={() => go(r.topic.key)}>
                      <span className="help-result-topic">{r.topic.label} › {r.title}</span>
                      {r.lines.map((l) => <span key={l} className="help-result-line"><Rich text={l} /></span>)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-note">
                  <Search size={26} />
                  <div>No results for “{query.trim()}”.</div>
                  <div className="hint">Try a word like “artwork”, “rotate” or “PDF”.</div>
                </div>
              )
            ) : (
              <>
                <TopicBody topic={topic} />
                {next && (
                  <button className="btn btn-ghost help-next" onClick={() => go(next.key)}>
                    Next: {next.label} →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
