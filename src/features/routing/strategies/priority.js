import { pickNextByScore } from './shared.js'

export function orderPriority(wps, start) {
  const pri = wps.filter(w => w.hasPriority)
  const rest = wps.filter(w => !w.hasPriority)

  const orderGroup = (group) => {
    const pool = [...group]
    const res = []
    let cur = { ...start }
    while (pool.length) {
      const idx = pickNextByScore(pool, cur, 0)
      const next = pool[idx]
      res.push(next)
      cur = { lat: next.lat, lng: next.lng }
      pool.splice(idx,1)
    }
    return res
  }
  return [...orderGroup(pri), ...orderGroup(rest)]
}
