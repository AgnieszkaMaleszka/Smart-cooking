// Sieciowa trasa: nearest-neighbor po macierzy czasów OSRM + 2-opt.
import { fetchTable } from '../osrm.js'
import { orderShortest } from './shortest.js'
import { getDistance } from './shared.js' // <— nowy import (5 m filtr)

function nnOrder(matrix, startIndex = 0) {
  const n = matrix.length
  const unvisited = new Set(Array.from({length:n}, (_,i)=>i))
  unvisited.delete(startIndex)
  const path = [startIndex]
  let cur = startIndex
  while (unvisited.size) {
    let best = null, bestCost = Infinity
    for (const j of unvisited) {
      const c = matrix[cur][j] ?? Infinity
      if (c < bestCost) { bestCost = c; best = j }
    }
    if (best == null) break
    path.push(best)
    unvisited.delete(best)
    cur = best
  }
  return path
}

function twoOpt(path, M, { maxIter = 200 } = {}) {
  const n = path.length
  if (n < 4) return path.slice()
  let best = path.slice()
  let improved = true, iter = 0
  while (improved && iter++ < maxIter) {
    improved = false
    for (let i = 1; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        const A=best[i-1], B=best[i], C=best[k], D=best[k+1]
        const delta = (M[A][B] + M[C][D]) - (M[A][C] + M[B][D])
        if (delta > 1e-6) {
          best = best.slice(0, i).concat(best.slice(i, k+1).reverse(), best.slice(k+1))
          improved = true
        }
      }
    }
  }
  return best
}

/** Ułóż punkty po czasie przejazdu z OSRM, zwróć KOLEJNOŚĆ BEZ startu. */
export async function orderShortestNetwork(wps, start, { mode='car' } = {}) {
  if (!wps?.length) return []
  if (!start || start.lat==null || start.lng==null) return orderShortest(wps, wps[0])

  // odfiltruj punkty na "starcie" (np. stoisz w sklepie) – <5 m
  const filtered = wps.filter(p => getDistance(start.lat, start.lng, p.lat, p.lng) >= 5)
  if (!filtered.length) return []

  const coords = [{ lat: start.lat, lng: start.lng }, ...filtered]
  try {
    const profile = mode === 'walk' ? 'walking' : 'driving'
    const M = await fetchTable(coords, profile, { annotations: 'duration' })
    const nn = nnOrder(M, 0)
    const opt = twoOpt(nn, M)
    const orderIdx = opt.filter(i => i !== 0)
    return orderIdx.map(i => filtered[i-1])
  } catch (e) {
    console.warn('[shortestNetwork] fallback to haversine:', e)
    return orderShortest(filtered, start)
  }
}
