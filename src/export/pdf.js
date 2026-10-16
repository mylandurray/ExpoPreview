import {
  billOfMaterials, getDef, itemDisplayName, itemWidth, surfaceSizes, fmtSize, fmtM, worldOutline,
} from '../catalog/items'
import { STAND_TYPES } from '../state/store'
import { loadImage } from '../utils/files'

// Client-facing mockup PDF. All measurements are in millimetres on the page.

const INK = [21, 24, 29]
const MUTED = [112, 119, 130]
const RULE = [224, 227, 232]
const ACCENT = [47, 107, 255]
const SOFT = [246, 247, 249]

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(rgb, toward, t) {
  return rgb.map((c, i) => Math.round(c + (toward[i] - c) * t))
}

function fit(iw, ih, bw, bh) {
  const s = Math.min(bw / iw, bh / ih)
  return { w: iw * s, h: ih * s }
}

const formatOf = (dataUrl) => (/^data:image\/png/.test(dataUrl) ? 'PNG' : 'JPEG')

// Small JPEG copy of an artwork for the checklist, so the PDF stays light.
async function thumbnail(url, max = 240) {
  const img = await loadImage(url)
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * s))
  c.height = Math.max(1, Math.round(img.naturalHeight * s))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return { url: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }
}

export async function buildMockupPdf({ doc, views, options, branding }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: options.paper, compress: true })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = options.paper === 'a3' ? 18 : 14
  const k = W / 297 // type scale relative to A4
  const top = M + 17 * k
  const bottom = H - M - 6 * k
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const project = doc.project.name || 'Untitled stand'
  const client = doc.project.client
  const logo = branding.logo ? await loadImage(branding.logo).then((img) => ({ img, url: branding.logo })).catch(() => null) : null
  let pageNo = 0

  const font = (size, style = 'normal', color = INK) => {
    pdf.setFont('helvetica', style)
    pdf.setFontSize(size * k)
    pdf.setTextColor(...color)
  }

  const newPage = (title) => {
    if (pageNo > 0) pdf.addPage()
    pageNo++
    // Header
    if (logo) {
      const s = fit(logo.img.naturalWidth, logo.img.naturalHeight, 42 * k, 10 * k)
      pdf.addImage(logo.url, formatOf(logo.url), M, M, s.w, s.h)
    } else {
      font(11, 'bold')
      pdf.text(branding.company || 'Stand mockup', M, M + 6 * k)
    }
    font(8, 'bold', MUTED)
    pdf.text('STAND MOCKUP', W - M, M + 2.5 * k, { align: 'right' })
    font(12, 'bold')
    pdf.text(title, W - M, M + 8.5 * k, { align: 'right' })
    pdf.setDrawColor(...RULE)
    pdf.setLineWidth(0.3)
    pdf.line(M, M + 12 * k, W - M, M + 12 * k)
    // Footer
    font(8, 'normal', MUTED)
    pdf.text([project, client].filter(Boolean).join('  ·  '), M, H - M)
    pdf.text(`${date}  ·  ${pageNo}`, W - M, H - M, { align: 'right' })
  }

  const label = (text, x, y, align = 'left') => {
    font(7.5, 'bold', MUTED)
    pdf.text(text.toUpperCase(), x, y, { align })
  }

  const image = (url, x, y, bw, bh, iw, ih) => {
    const s = fit(iw, ih, bw, bh)
    const ix = x + (bw - s.w) / 2
    const iy = y + (bh - s.h) / 2
    pdf.addImage(url, formatOf(url), ix, iy, s.w, s.h, undefined, 'FAST')
    pdf.setDrawColor(...RULE)
    pdf.setLineWidth(0.25)
    pdf.rect(ix, iy, s.w, s.h)
    return { x: ix, y: iy, ...s }
  }

  const { lines, frames } = billOfMaterials(doc.items, doc.customItems)
  const { width: SW, depth: SD, type } = doc.stand

  // ─── Cover ──────────────────────────────────────────────────────────────────
  newPage(project)
  const sideW = 74 * k
  const gap = 10 * k
  const cover = views[0]
  const imgBox = { x: M, y: top, w: W - M * 2 - sideW - gap, h: bottom - top }
  if (cover) image(cover.url, imgBox.x, imgBox.y, imgBox.w, imgBox.h, cover.w, cover.h)

  let sx = W - M - sideW
  let sy = top + 3 * k
  label('Project', sx, sy)
  font(17, 'bold')
  const titleLines = pdf.splitTextToSize(project, sideW)
  pdf.text(titleLines, sx, sy + 7 * k)
  sy += 7 * k + titleLines.length * 7 * k

  const facts = [
    client && ['Client', client],
    branding.company && ['Prepared by', branding.company],
    ['Date', date],
    ['Stand', `${fmtM(SW)} × ${fmtM(SD)}  ·  ${(SW * SD).toFixed(1)} m²`],
    ['Type', `${STAND_TYPES[type].label}${STAND_TYPES[type].walls.length ? ` (${STAND_TYPES[type].walls.join(', ')} walls)` : ' (open on all sides)'}`],
  ].filter(Boolean)
  for (const [l, v] of facts) {
    label(l, sx, sy)
    font(10)
    const vl = pdf.splitTextToSize(v, sideW)
    pdf.text(vl, sx, sy + 4.8 * k)
    sy += 6.5 * k + vl.length * 4.3 * k
  }

  if (lines.length) {
    sy += 2 * k
    pdf.setDrawColor(...RULE)
    pdf.line(sx, sy, sx + sideW, sy)
    sy += 6 * k
    label('On the stand', sx, sy)
    sy += 5.5 * k
    font(9.5)
    for (const l of lines) {
      if (sy > bottom - 20 * k) break
      pdf.text(l.label, sx, sy)
      font(9.5, 'bold')
      pdf.text(`× ${l.qty}`, sx + sideW, sy, { align: 'right' })
      font(9.5)
      sy += 5 * k
    }
  }

  if (doc.project.notes) {
    sy += 4 * k
    label('Notes', sx, sy)
    font(9, 'normal', [70, 76, 86])
    const nl = pdf.splitTextToSize(doc.project.notes, sideW)
    const room = Math.max(1, Math.floor((bottom - sy - 4 * k) / (4 * k)))
    pdf.text(nl.slice(0, room), sx, sy + 5 * k)
  }

  // ─── Additional views ──────────────────────────────────────────────────────
  for (const v of views.slice(1)) {
    newPage(v.label)
    image(v.url, M, top, W - M * 2, bottom - top, v.w, v.h)
  }

  // ─── Floor plan ────────────────────────────────────────────────────────────
  if (options.plan) {
    newPage('Floor plan')
    drawPlan(pdf, doc, { x: M, y: top, w: W - M * 2 - 84 * k, h: bottom - top }, k, font, label)
    // Legend
    const lx = W - M - 76 * k
    let ly = top + 3 * k
    label('Key', lx, ly)
    ly += 6 * k
    doc.items.forEach((item, i) => {
      const def = getDef(item.type, doc.customItems)
      if (!def || ly > bottom - 4 * k) return
      numberBadge(pdf, lx + 2.6 * k, ly - 1.2 * k, i + 1, k)
      font(9)
      pdf.text(itemDisplayName(item, def), lx + 7.5 * k, ly)
      font(8, 'normal', MUTED)
      pdf.text(`${fmtM(itemWidth(item, def))} × ${fmtM(def.d)} × ${fmtM(def.h)}`, lx + 7.5 * k, ly + 4 * k)
      ly += 10 * k
    })
    if (!doc.items.length) {
      font(9, 'normal', MUTED)
      pdf.text('No items placed yet.', lx, ly)
    }
  }

  // ─── Artwork checklist ─────────────────────────────────────────────────────
  if (options.artwork && doc.items.length) {
    const rows = []
    doc.items.forEach((item, i) => {
      const def = getDef(item.type, doc.customItems)
      if (!def) return
      for (const s of surfaceSizes(item, def)) {
        rows.push({ n: i + 1, name: itemDisplayName(item, def), surface: s.label, size: fmtSize(s.size), url: item.graphics?.[s.key] })
      }
    })
    const thumbs = await Promise.all(rows.map((r) => (r.url ? thumbnail(r.url).catch(() => null) : null)))

    const cols = [
      { x: M, label: '#' },
      { x: M + 10 * k, label: 'Artwork' },
      { x: M + 40 * k, label: 'Item' },
      { x: M + 120 * k, label: 'Surface' },
      { x: M + 150 * k, label: 'Visible print area' },
      { x: M + 205 * k, label: 'Status' },
    ]
    const rowH = 16 * k
    let y
    const head = () => {
      newPage('Artwork checklist')
      y = top + 4 * k
      cols.forEach((c) => label(c.label, c.x, y))
      y += 3 * k
      pdf.setDrawColor(...RULE)
      pdf.line(M, y, W - M, y)
    }
    head()
    rows.forEach((r, i) => {
      if (y + rowH > bottom) head()
      const cy = y + rowH / 2 + 1.5 * k
      numberBadge(pdf, cols[0].x + 2.6 * k, cy - 1.2 * k, r.n, k)
      const t = thumbs[i]
      if (t) {
        const s = fit(t.w, t.h, 24 * k, rowH - 4 * k)
        pdf.addImage(t.url, 'JPEG', cols[1].x, y + (rowH - s.h) / 2, s.w, s.h)
      } else {
        pdf.setFillColor(...SOFT)
        pdf.setDrawColor(...RULE)
        pdf.rect(cols[1].x, y + 2 * k, 24 * k, rowH - 4 * k, 'FD')
      }
      font(9.5)
      pdf.text(r.name, cols[2].x, cy)
      pdf.text(r.surface, cols[3].x, cy)
      pdf.text(r.size, cols[4].x, cy)
      font(9.5, 'bold', r.url ? [31, 157, 97] : [201, 120, 20])
      pdf.text(r.url ? 'Artwork supplied' : 'Awaiting artwork', cols[5].x, cy)
      y += rowH
      pdf.setDrawColor(...RULE)
      pdf.line(M, y, W - M, y)
    })
  }

  // ─── Components (internal) ─────────────────────────────────────────────────
  if (options.components && lines.length) {
    newPage('Bill of materials')
    const colW = (W - M * 2 - 12 * k) / 2
    let x = M
    let y = top + 4 * k
    const row = (a, b, bold) => {
      if (y > bottom - 6 * k) {
        if (x === M) { x = M + colW + 12 * k; y = top + 4 * k } else { newPage('Bill of materials'); x = M; y = top + 4 * k }
      }
      font(9.5, bold ? 'bold' : 'normal')
      pdf.text(a, x, y)
      font(9.5, 'bold')
      pdf.text(String(b), x + colW, y, { align: 'right' })
      y += 4 * k
      pdf.setDrawColor(...RULE)
      pdf.line(x, y - 1.5 * k, x + colW, y - 1.5 * k)
      y += 2.5 * k
    }
    label('Items', x, y)
    y += 6 * k
    lines.forEach((l) => row(l.label, `× ${l.qty}`))
    for (const f of frames) {
      y += 5 * k
      label(`Pixlip ${f.w} m frame${f.count > 1 ? ` × ${f.count}` : ''}`, x, y)
      y += 6 * k
      f.components.forEach((c) => row(c.label, c.total))
    }
  }

  return pdf
}

function numberBadge(pdf, cx, cy, n, k) {
  pdf.setFillColor(...ACCENT)
  pdf.circle(cx, cy, 2.6 * k, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7 * k)
  pdf.setTextColor(255, 255, 255)
  pdf.text(String(n), cx, cy + 0.9 * k, { align: 'center' })
}

// Top-down plan, front (aisle) at the bottom of the page.
function drawPlan(pdf, doc, box, k, font, label) {
  const { width: SW, depth: SD, type, floorColor } = doc.stand
  const walls = STAND_TYPES[type].walls
  let minX = -SW / 2, maxX = SW / 2, minZ = -SD / 2, maxZ = SD / 2
  const outlines = doc.items.map((item) => {
    const def = getDef(item.type, doc.customItems)
    if (!def) return null
    const pts = worldOutline(item, def)
    for (const [x, z] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    }
    return pts
  })

  const pad = 16 * k
  const s = Math.min((box.w - pad * 2) / (maxX - minX), (box.h - pad * 2) / (maxZ - minZ))
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * s
  const oy = box.y + box.h / 2 - ((minZ + maxZ) / 2) * s
  const px = (x) => ox + x * s
  const py = (z) => oy + z * s

  // Carpet, tinted towards white so labels stay legible.
  pdf.setFillColor(...mix(hexToRgb(floorColor), [255, 255, 255], 0.82))
  pdf.rect(px(-SW / 2), py(-SD / 2), SW * s, SD * s, 'F')

  // 1 m grid
  pdf.setDrawColor(...mix(hexToRgb(floorColor), [255, 255, 255], 0.6))
  pdf.setLineWidth(0.1)
  for (let x = Math.ceil(-SW / 2); x <= SW / 2; x++) pdf.line(px(x), py(-SD / 2), px(x), py(SD / 2))
  for (let z = Math.ceil(-SD / 2); z <= SD / 2; z++) pdf.line(px(-SW / 2), py(z), px(SW / 2), py(z))

  pdf.setDrawColor(...INK)
  pdf.setLineWidth(0.35)
  pdf.rect(px(-SW / 2), py(-SD / 2), SW * s, SD * s)

  // Shell-scheme walls
  pdf.setLineWidth(1.6 * k)
  pdf.setDrawColor(60, 64, 72)
  if (walls.includes('back')) pdf.line(px(-SW / 2), py(-SD / 2) - 0.8 * k, px(SW / 2), py(-SD / 2) - 0.8 * k)
  if (walls.includes('left')) pdf.line(px(-SW / 2) - 0.8 * k, py(-SD / 2), px(-SW / 2) - 0.8 * k, py(SD / 2))
  if (walls.includes('right')) pdf.line(px(SW / 2) + 0.8 * k, py(-SD / 2), px(SW / 2) + 0.8 * k, py(SD / 2))

  // Items
  pdf.setLineWidth(0.35)
  outlines.forEach((pts, i) => {
    if (!pts) return
    const [x0, z0] = pts[0]
    const segs = pts.slice(1).map(([x, z], j) => [(x - pts[j][0]) * s, (z - pts[j][1]) * s])
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(...ACCENT)
    pdf.lines(segs, px(x0), py(z0), [1, 1], 'FD', true)
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const cz = pts.reduce((a, p) => a + p[1], 0) / pts.length
    numberBadge(pdf, px(cx), py(cz), i + 1, k)
  })

  // Dimension lines
  pdf.setDrawColor(...MUTED)
  pdf.setLineWidth(0.25)
  const dy = py(-SD / 2) - 7 * k
  pdf.line(px(-SW / 2), dy, px(SW / 2), dy)
  pdf.line(px(-SW / 2), dy - 1.5 * k, px(-SW / 2), dy + 1.5 * k)
  pdf.line(px(SW / 2), dy - 1.5 * k, px(SW / 2), dy + 1.5 * k)
  font(9, 'bold')
  pdf.text(fmtM(SW), px(0), dy - 1.8 * k, { align: 'center' })

  const dx = px(-SW / 2) - 7 * k
  pdf.line(dx, py(-SD / 2), dx, py(SD / 2))
  pdf.line(dx - 1.5 * k, py(-SD / 2), dx + 1.5 * k, py(-SD / 2))
  pdf.line(dx - 1.5 * k, py(SD / 2), dx + 1.5 * k, py(SD / 2))
  // Rotated text ignores `align`, so centre it by hand.
  pdf.text(fmtM(SD), dx - 1.8 * k, py(0) + pdf.getTextWidth(fmtM(SD)) / 2, { angle: 90 })

  label('Front  ·  aisle', px(0), py(SD / 2) + 7 * k, 'center')
}
