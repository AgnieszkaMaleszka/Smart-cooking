import { pickNextByScore } from './shared.js'

export function orderLight(wps, start, mode) {
  const alpha = mode === 'car' ? 0 : 0.7 // pieszo premiuj wagę
  const pool = [...wps]
  const ordered = []
  let cur = { ...start }
  while (pool.length) {
    const idx = pickNextByScore(pool, cur, alpha)
    const next = pool[idx]
    ordered.push(next)
    cur = { lat: next.lat, lng: next.lng }
    pool.splice(idx,1)
  }
  return ordered
}
