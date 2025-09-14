// Tworzy dataURL z *pełnym wycinkiem* (bez dodatkowego przycinania), skalowanym tak,
// by cały wycinek mieścił się na ekranie (bez potrzeby przewijania/panowania).
// - rect: w procentach {x,y,w,h} względem całej strony (0–100)
// - maxSide: maksymalny dłuższy bok wynikowego obrazka w px (dla ostrości i pamięci)
import { proxifyImage } from '../utils/imageProxy'

export async function cropToDataURL(pageUrl, rect, { maxSide = 1400, background = '#FFFFFF' } = {}) {
  const img = await loadImage(proxifyImage(pageUrl))
  const { x, y, w, h } = normalizeRect(rect)

  // obszar źródłowy w pikselach
  const sx = (img.naturalWidth * x) / 100
  const sy = (img.naturalHeight * y) / 100
  const sw = (img.naturalWidth * w) / 100
  const sh = (img.naturalHeight * h) / 100

  // skalujemy *cały* wycinek tak, by dłuższy bok == maxSide (bez rozciągania)
  const longer = Math.max(sw, sh)
  const scale = Math.min(1, maxSide / Math.max(1, longer)) // nie powiększamy ponad 1:1
  const outW = Math.max(32, Math.round(sw * scale))
  const outH = Math.max(32, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')

  // tło (gdy wycinek ma przezroczystości po stronie źródła – raczej nie, ale na wszelki wypadek)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, outW, outH)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

  // JPEG ~0.92 jest ostre i lekkie
  return canvas.toDataURL('image/jpeg', 0.92)
}

function normalizeRect(r = {}) {
  const clamp = (v, min, max, d) => {
    v = Number.isFinite(+v) ? +v : d
    return Math.min(max, Math.max(min, v))
  }
  return {
    x: clamp(r.x, 0, 100, 0),
    y: clamp(r.y, 0, 100, 0),
    w: clamp(r.w, 0.001, 100, 100),
    h: clamp(r.h, 0.001, 100, 100)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('Brak src'))
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu: ' + src))
    img.src = src
  })
}
