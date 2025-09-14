// src/services/userLists.js
import { proxifyImage } from '../utils/imageProxy'
import { cropToDataURL } from '../utils/cropToDataUrl'

/**
 * Zbiera listy użytkownika z localStorage (flyerSelections:<id>)
 * i buduje strukturę zgodną ze SmartShopping (wraz z miniaturami).
 *
 * Zwraca tablicę:
 * [ { id, storeName, createdAt, logoUrl?, pages?: string[], items: [...] } ]
 */

const PFX_SEL   = 'flyerSelections:'
const PFX_META  = 'flyerMeta:'
const PFX_PAGES = 'flyerPages:'
const PFX_SHOP  = 'flyerShop:'
const PFX_THUM  = 'flyerThumbs:' // jeżeli trzymasz mapę id->dataURL

function safeParse(json, fb) { try { return JSON.parse(json) } catch { return fb } }
function toNum(v, def = 0) {
  if (v == null || v === '') return def
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : def
}
function parsePrice(txt) {
  if (!txt) return null
  const s = String(txt).replace(/\s+/g,'').replace(/[zł€$]/gi,'').replace(',', '.')
  const m = s.match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
function parseCreatedAt(selections, meta) {
  // 1) preferuj meta.createdAt, jeśli da się sparsować
  const mdate = meta?.createdAt || meta?.time || meta?.created_at
  const md = mdate ? new Date(mdate).getTime() : NaN
  if (Number.isFinite(md)) return new Date(md).toISOString()

  // 2) z selection.at (może być number lub ISO)
  const ts = (Array.isArray(selections) ? selections : []).map(s => {
    if (typeof s?.at === 'number') return s.at
    const t = s?.at ? new Date(s.at).getTime() : NaN
    return Number.isFinite(t) ? t : NaN
  }).filter(Number.isFinite)

  const best = ts.length ? Math.max(...ts) : Date.now()
  return new Date(best).toISOString()
}

function normalizeItem(raw, idx, fallbackThumb) {
  const id = String(raw?.id ?? raw?.sku ?? raw?.code ?? `item-${idx}`)
  const name = (raw?.name || raw?.title || 'Produkt').trim()
  const qty = toNum(raw?.qty, 1) || 1
  const unit = raw?.unit || 'szt.'
  const weight = toNum(raw?.weight, 0)
  const price0 = raw?.estPrice ?? raw?.price
  const estPrice = toNum(price0, parsePrice(price0) ?? 0)
  const promo = Boolean(raw?.promo || raw?.isPromo || raw?.onSale || true)
  const bought = Boolean(raw?.bought || raw?.done)
  const page = raw?.page ?? null
  const rect = raw?.rect ?? null
  const thumbnail = raw?.thumbnail || fallbackThumb || ''
  return { id, name, qty, unit, estPrice, promo, weight, bought, page, rect, thumbnail }
}

function ensureUniqueItemIds(items) {
  const seen = new Set()
  return items.map((it, idx) => {
    let nid = String(it.id ?? `item-${idx}`)
    if (seen.has(nid)) nid = `${nid}-${idx}`
    seen.add(nid)
    return { ...it, id: nid }
  })
}

/** Bezpieczny crop z limitem czasu (żeby nie wisieć na CORS/IMG) */
async function cropWithTimeout(pageUrl, rect, { maxSide = 200, background = '#FFFFFF', timeoutMs = 5000 } = {}) {
  const safeUrl = proxifyImage(pageUrl)
  return new Promise((resolve) => {
    let done = false
    const t = setTimeout(() => {
      if (!done) { done = true; resolve('') } // fallback: brak miniatury
    }, timeoutMs)
    cropToDataURL(safeUrl, rect, { maxSide, background })
      .then(data => { if (!done) { done = true; clearTimeout(t); resolve(data || '') } })
      .catch(() => { if (!done) { done = true; clearTimeout(t); resolve('') } })
  })
}

/** Wyciągnij „pages” zarówno z tablicy jak i obiektu {index:url} */
function readPages(ls, flyerId) {
  const raw = safeParse(ls.getItem(PFX_PAGES + flyerId), [])
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    // posortuj po kluczach liczbowych
    return Object.keys(raw).sort((a,b)=>Number(a)-Number(b)).map(k => raw[k])
  }
  return []
}

function readStoreName(ls, flyerId, meta) {
  // preferuj flyerShop: jeżeli jest
  const shopRaw = safeParse(ls.getItem(PFX_SHOP + flyerId), null)
  if (typeof shopRaw === 'string' && shopRaw.trim()) return shopRaw.trim()
  if (shopRaw && typeof shopRaw === 'object') return shopRaw.name || shopRaw.storeName || shopRaw.brand || null

  // następnie meta
  return meta?.storeName || meta?.shopName || meta?.brand || 'Gazetka'
}

function readThumbsMap(ls, flyerId) {
  const t = safeParse(ls.getItem(PFX_THUM + flyerId), null)
  return (t && typeof t === 'object') ? t : null
}

/** Limit równoległości dla croppingu (żeby nie zabić przeglądarki) */
async function mapWithConcurrency(items, fn, concurrency = 4) {
  const out = new Array(items.length)
  let idx = 0
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++
      if (i >= items.length) break
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

export async function loadAllUserLists({ thumbMaxSide = 200 } = {}) {
  const ls = window.localStorage
  const keys = Object.keys(ls).filter(k => k.startsWith(PFX_SEL))

  const lists = []

  // 1) Zbierz dostępne „sufiksy” (flyerId)
  const flyerIds = keys.map(k => k.slice(PFX_SEL.length))

  // 2) Dla każdego flyerId zbuduj listę
  for (const flyerId of flyerIds) {
    const selections = safeParse(ls.getItem(PFX_SEL + flyerId), [])
    if (!Array.isArray(selections) || !selections.length) continue

    const meta  = safeParse(ls.getItem(PFX_META + flyerId), {}) || {}
    const pages = readPages(ls, flyerId)
    const thumbsMap = readThumbsMap(ls, flyerId)
    const storeName = readStoreName(ls, flyerId, meta)
    const createdAt = parseCreatedAt(selections, meta)

    // Zbuduj pozycje
    const baseItems = selections.map((s, idx) => {
      const thumbById = (thumbsMap && s?.id && thumbsMap[s.id]) ? thumbsMap[s.id] : null
      return normalizeItem({ ...s, thumbnail: s?.thumbnail || thumbById }, idx, null)
    })

    // Miniatury: tnij tylko jeśli mamy strony i rect; z limitem równoległości i timeoutami
    const items = await mapWithConcurrency(baseItems, async (it) => {
      if (!it.thumbnail && typeof it.page === 'number' && pages[it.page] && it.rect) {
        it.thumbnail = await cropWithTimeout(pages[it.page], it.rect, { maxSide: thumbMaxSide, background: '#FFFFFF', timeoutMs: 5000 })
      }
      return it
    }, 4)

    lists.push({
      id: `flyer:${flyerId}`,     // forma przyjazna do split(/[:\-]/).pop()
      storeName,
      createdAt,
      logoUrl: meta.logoUrl || '', // jeśli masz logo w meta
      pages,
      items: ensureUniqueItemIds(items),
    })
  }

  // 3) Fallback: snapshot smartshop_user_lists (jeżeli nic nie złożyliśmy)
  if (!lists.length) {
    try {
      const raw = ls.getItem('smartshop_user_lists')
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed) && parsed.length) return parsed
    } catch { /* ignore */ }
  }

  return lists
}
