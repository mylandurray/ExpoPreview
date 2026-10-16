import { useEffect, useMemo, useState } from 'react'
import { SRGBColorSpace, TextureLoader } from 'three'

// Decoded textures are shared between every surface using the same artwork;
// each surface gets its own clone so it can crop independently.
const cache = new Map()
const loader = new TextureLoader()

function loadBase(url) {
  if (!cache.has(url)) {
    const p = loader.loadAsync(url).then((t) => {
      t.colorSpace = SRGBColorSpace
      t.anisotropy = 8
      return t
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url)
}

// Loads `url` and crops it to fill a targetW × targetH surface without
// distortion (CSS `object-fit: cover`).
export function useGraphicTexture(url, targetW, targetH) {
  const [base, setBase] = useState(null)

  useEffect(() => {
    if (!url) { setBase(null); return }
    let live = true
    loadBase(url).then((t) => live && setBase({ url, t })).catch(() => live && setBase(null))
    return () => { live = false }
  }, [url])

  const texture = useMemo(() => {
    if (!base || base.url !== url || !targetW || !targetH) return null
    const t = base.t.clone()
    const imageAspect = t.image.width / t.image.height
    const targetAspect = targetW / targetH
    if (imageAspect > targetAspect) {
      const s = targetAspect / imageAspect
      t.repeat.set(s, 1)
      t.offset.set((1 - s) / 2, 0)
    } else {
      const s = imageAspect / targetAspect
      t.repeat.set(1, s)
      t.offset.set(0, (1 - s) / 2)
    }
    t.needsUpdate = true
    return t
  }, [base, url, targetW, targetH])

  useEffect(() => () => texture?.dispose(), [texture])

  return url ? texture : null
}
