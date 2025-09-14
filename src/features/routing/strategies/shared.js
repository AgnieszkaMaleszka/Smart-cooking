// Wspólne helpery dla strategii tras

/** Spherical law of cosines – szybki i stabilny */
export function getDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null || lon1 == null ||
    lat2 == null || lon2 == null
  ) return Infinity

  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  // clamp argument dla acos, by uniknąć NaN przez błędy numeryczne
  let cosArg = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  if (cosArg > 1) cosArg = 1
  else if (cosArg < -1) cosArg = -1

  const d = Math.acos(cosArg) * R
  return isNaN(d) ? 0 : d
}

/**
 * Wybiera indeks najlepszego kandydata z puli względem aktualnej pozycji.
 * weightAlpha=0 → liczy się tylko dystans (użyjemy dla 'shortest').
 * Każdy element puli powinien mieć {lat, lng, weight?}
 */
export function pickNextByScore(pool, cur, weightAlpha = 0) {
  if (!pool.length) return -1
  const dists = pool.map(p => getDistance(cur.lat, cur.lng, p.lat, p.lng))
  const weights = pool.map(p => Number(p.weight) || 0)

  const dMin = Math.min(...dists), dMax = Math.max(...dists)
  const wMin = Math.min(...weights), wMax = Math.max(...weights)

  let bestIdx = 0, bestScore = Infinity
  for (let i = 0; i < pool.length; i++) {
    const dNorm = dMax === dMin ? 0 : (dists[i] - dMin) / (dMax - dMin)
    const wNorm = wMax === wMin ? 0 : (weights[i] - wMin) / (wMax - wMin)
    const score = (1 - weightAlpha) * dNorm + (weightAlpha) * wNorm
    if (score < bestScore) { bestScore = score; bestIdx = i }
  }
  return bestIdx
}

/** Opcjonalnie: deduplikacja kandydatów po sklepie (id/koordy/nazwa) */
export function dedupeByShop(wps) {
  const seen = new Set()
  return wps.filter(w => {
    const latOk = typeof w.lat === 'number'
    const lngOk = typeof w.lng === 'number'
    const key = w.shopId || w.osmId || w.id ||
      (latOk && lngOk ? `${w.storeName}:${w.lat.toFixed(5)},${w.lng.toFixed(5)}` : w.storeName || Math.random())
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
