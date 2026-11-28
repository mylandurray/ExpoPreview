// Turns an uploaded image or PDF into a data URL sized for use as a texture.
// Large artwork (print-ready files are often 10k+ px) is scaled down so saved
// layouts stay a manageable size; the long edge is capped at `maxSize`.

const MAX_SIZE = 3072

export const ACCEPTED_GRAPHICS = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,.pdf'

export function isGraphicFile(file) {
  return !!file && (file.type.startsWith('image/') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
}

export async function fileToGraphic(file, maxSize = MAX_SIZE) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return pdfToGraphic(file, maxSize)
  return imageToGraphic(file, maxSize)
}

async function imageToGraphic(file, maxSize) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth || 2048
    const h = img.naturalHeight || 2048
    const scale = Math.min(1, maxSize / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const keepAlpha = /png|webp|gif|svg/.test(file.type)
    return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// PDF import on older browsers, in three tiers:
//  1. Current browsers get pdf.js 6's standard build. It calls very recent
//     JavaScript APIs without polyfills, so older engines fail with
//     "x is not a function".
//  2. Browsers missing any of those APIs get pdf.js's legacy build, which
//     polyfills most of them, plus our pdfPolyfills.js for the two it doesn't
//     (main thread and worker). That reaches back to about Safari/iOS 15.4.
//  3. Anything older gets a clear message to use PNG/JPG artwork instead.
// Each build is downloaded only when a PDF is imported.

export const PDF_UNSUPPORTED_MESSAGE =
  'This browser is too old to import PDFs. Export the artwork as PNG or JPG, or update the browser.'

export function needsLegacyPdfjs(g = globalThis) {
  return !(
    typeof g.Promise?.withResolvers === 'function' &&
    typeof g.Promise?.try === 'function' &&
    typeof g.AbortSignal?.any === 'function' &&
    typeof g.Map?.prototype.getOrInsertComputed === 'function' &&
    typeof g.Math?.sumPrecise === 'function' &&
    typeof g.Uint8Array?.fromBase64 === 'function' &&
    typeof g.Uint8Array?.prototype.toHex === 'function' &&
    typeof g.Iterator?.prototype.toArray === 'function' &&
    typeof g.Set?.prototype.union === 'function' &&
    typeof g.URL?.parse === 'function'
  )
}

// What the legacy build needs that neither it nor pdfPolyfills.js provides.
export function canRunLegacyPdfjs(g = globalThis) {
  return (
    typeof g.Object?.hasOwn === 'function' &&
    typeof g.Array?.prototype.findLast === 'function' &&
    typeof g.structuredClone === 'function' &&
    typeof g.Worker === 'function'
  )
}

let useLegacyPdfjs = needsLegacyPdfjs()

function unsupported(cause) {
  const err = new Error(PDF_UNSUPPORTED_MESSAGE, { cause })
  err.userMessage = PDF_UNSUPPORTED_MESSAGE
  return err
}

async function loadPdfjs(legacy) {
  if (!legacy) {
    const [pdfjs, { default: workerUrl }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  }
  if (!canRunLegacyPdfjs()) throw unsupported()
  await import('./pdfPolyfills.js')
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('./pdfLegacyWorker.js?worker&url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

// A missing API or unparseable syntax shows up as a TypeError, ReferenceError
// or SyntaxError (or, from the worker, as that error's message); damaged or
// password-protected PDFs throw pdf.js's own error types instead.
function isEngineError(err) {
  return err instanceof TypeError || err instanceof ReferenceError || err instanceof SyntaxError ||
    /is not a function|is not defined|is not a constructor|Unexpected token|fake worker/i.test(err?.message || '')
}

async function pdfToGraphic(file, maxSize) {
  const data = await file.arrayBuffer()
  try {
    return await renderPdf(await loadPdfjs(useLegacyPdfjs), data.slice(0), maxSize)
  } catch (err) {
    if (err.userMessage || !isEngineError(err)) throw err
    if (useLegacyPdfjs) throw unsupported(err)
    // Safety net for gaps the feature check missed: retry once with the
    // legacy build and keep using it for the rest of the session.
    console.warn('pdf.js standard build failed, retrying with the legacy build:', err)
    useLegacyPdfjs = true
    try {
      return await renderPdf(await loadPdfjs(true), data, maxSize)
    } catch (retryErr) {
      throw retryErr.userMessage || !isEngineError(retryErr) ? retryErr : unsupported(retryErr)
    }
  }
}

async function renderPdf(pdfjs, data, maxSize) {
  // Destroying the loading task frees the worker's copy of the document, also
  // when the file is damaged, password-protected or rendering fails.
  const task = pdfjs.getDocument({ data })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: maxSize / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.9)
  } finally {
    await task.destroy()
  }
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}
