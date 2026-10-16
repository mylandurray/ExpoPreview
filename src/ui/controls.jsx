import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

// ─── Item glyphs ──────────────────────────────────────────────────────────────
// Small line drawings for the catalogue, one per stock item.
const GLYPHS = {
  pixlip: (
    <>
      <rect x="6" y="5" width="20" height="21" rx="1" />
      <rect x="8.5" y="7.5" width="15" height="16" rx="0.5" fill="currentColor" opacity="0.18" stroke="none" />
      <path d="M9 28h4M19 28h4" />
    </>
  ),
  backdrop: (
    <>
      <path d="M4 7h24v18H4z" />
      <path d="M4 12l7-3 8 4 9-4" opacity="0.5" />
      <path d="M5 28h4M23 28h4" />
    </>
  ),
  pullup: (
    <>
      <rect x="10" y="4" width="12" height="20" rx="0.5" />
      <rect x="8.5" y="24" width="15" height="4" rx="2" />
      <path d="M13 9h6M13 12h4" opacity="0.6" />
    </>
  ),
  counter: (
    <>
      <rect x="4" y="11" width="24" height="3" rx="1" />
      <path d="M6 14v13h20V14" />
      <path d="M10 19h12" opacity="0.5" />
    </>
  ),
  'curved-counter': (
    <>
      <path d="M5 13c3-3 19-3 22 0" />
      <path d="M6 14v12c3 2 17 2 20 0V14" />
      <path d="M10 20c4 1.3 8 1.3 12 0" opacity="0.5" />
    </>
  ),
  'cylindrical-table': (
    <>
      <ellipse cx="16" cy="8" rx="9" ry="2.5" />
      <path d="M9 10v15M23 10v15" />
      <ellipse cx="16" cy="26" rx="8" ry="2" />
    </>
  ),
  custom: (
    <>
      <path d="M16 4l10 5v14l-10 5-10-5V9z" />
      <path d="M6 9l10 5 10-5M16 14v14" opacity="0.6" />
    </>
  ),
}

export function ItemGlyph({ type, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[type] ?? GLYPHS.custom}
    </svg>
  )
}

// ─── Form controls ────────────────────────────────────────────────────────────

export function Switch({ label, checked, onChange, hint }) {
  return (
    <label className="switch">
      <span>
        <span className="label">{label}</span>
        {hint && <div className="hint">{hint}</div>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}

export function Segmented({ value, options, onChange, tall = false, ariaLabel }) {
  return (
    <div className={`seg${tall ? ' seg-tall' : ''}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
          title={o.title}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Swatches({ value, presets, onChange, label }) {
  const custom = !presets.includes(value)
  return (
    <div className="swatches" role="group" aria-label={label}>
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch${value === c ? ' on' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
          aria-label={`Colour ${c}`}
        />
      ))}
      <label className={`swatch-custom${custom ? ' on' : ''}`} style={custom ? { background: value } : undefined} title="Custom colour">
        {!custom && <Plus size={13} />}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
      </label>
    </div>
  )
}

// Number input that lets you type freely and commits clamped values.
export function NumberField({ label, value, onChange, min, max, step = 0.1, unit = 'm' }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const commit = (raw) => {
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return setText(String(value))
    const clamped = Math.min(max, Math.max(min, n))
    if (clamped !== value) onChange(clamped)
    setText(String(clamped))
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-unit" data-unit={unit}>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseFloat(e.target.value)
            if (!Number.isNaN(n) && n >= min && n <= max) onChange(n)
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
    </label>
  )
}
