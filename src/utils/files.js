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

async function pdfToGraphic(file, maxSize) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
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
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image.'))
    img.src = src
  })
}
