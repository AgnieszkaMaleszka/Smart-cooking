import { pickNextByScore, getDistance } from './shared.js'

/**
 * Najkrótsza trasa – greedy nearest neighbor OD STARTU.
 * @param {Array<{lat:number,lng:number}>} wps  kandydaci (po deduplikacji)
 * @param {{lat:number,lng:number}} start       punkt startu
 * @returns {Array}                             kolejność odwiedzin (bez punktu startu)
 */
export function orderShortest(wps, start) {
  const pool = [...wps]

  // Jeśli któryś kandydat pokrywa się ze startem ~ do 5 m, usuń go z puli
  if (start && typeof start.lat === 'number' && typeof start.lng === 'number') {
    const idxSame = pool.findIndex(p => getDistance(start.lat, start.lng, p.lat, p.lng) < 5)
    if (idxSame !== -1) pool.splice(idxSame, 1)
  }

  const ordered = []
  let cur = start && typeof start.lat === 'number' && typeof start.lng === 'number'
    ? { lat: start.lat, lng: start.lng }
    : (pool.length ? { lat: pool[0].lat, lng: pool[0].lng } : null)

  while (pool.length && cur) {
    const idx = pickNextByScore(pool, cur, 0) // tylko dystans
    const next = pool[idx]
    ordered.push(next)
    cur = { lat: next.lat, lng: next.lng }
    pool.splice(idx, 1)
  }
  return ordered
}
