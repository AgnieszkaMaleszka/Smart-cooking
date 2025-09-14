/**
 * Odczytuje kontekst gazetki z LocalStorage:
 * - strony: `flyerPages:<id>` albo aliasy (`flyer:<id>:pages`, `pages:<id>`)
 * - meta sklepu: `flyerMeta:<id>`, `flyerShop:<id>`, `flyer:<id>:meta`, `shop:<id>`
 */
export function readFlyerContext(flyerId) {
  const pages = readFirstArray([
    `flyerPages:${flyerId}`,
    `flyer:${flyerId}:pages`,
    `pages:${flyerId}`,
  ])
  const meta = readFirstObject([
    `flyerMeta:${flyerId}`,
    `flyerShop:${flyerId}`,
    `flyer:${flyerId}:meta`,
    `shop:${flyerId}`,
  ])
  return { pages, meta }
}

function readFirstArray(keys) {
  for (const k of keys) {
    const v = readJSON(k)
    if (Array.isArray(v) && v.length) return v
  }
  return null
}
function readFirstObject(keys) {
  for (const k of keys) {
    const v = readJSON(k)
    if (v && typeof v === 'object') return v
  }
  return {}
}
function readJSON(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
