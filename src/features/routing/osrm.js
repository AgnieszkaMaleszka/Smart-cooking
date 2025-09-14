const DEFAULT_BASE = 'https://router.project-osrm.org'

export const OSRM_BASE =
  import.meta?.env?.VITE_OSRM_BASE?.replace(/\/+$/,'') || DEFAULT_BASE

export function profileFromMode(mode) {
  return mode === 'walk' ? 'walking' : 'driving'
}

function buildCoordsString(coords) {
  return coords.map(p => `${p.lng},${p.lat}`).join(';')
}

export async function fetchRoute(coords, profile = 'driving', { overview='full' } = {}) {
  if (!Array.isArray(coords) || coords.length < 2) return null
  const url = `${OSRM_BASE}/route/v1/${profile}/${buildCoordsString(coords)}?overview=${overview}&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM /route ${res.status}`)
  const data = await res.json()
  const r = data?.routes?.[0]
  if (!r) throw new Error('OSRM /route: empty')
  return {
    geojson: r.geometry,
    distance: Number(r.distance||0),
    duration: Number(r.duration||0)
  }
}

export async function fetchTable(coords, profile = 'driving', { annotations='duration' } = {}) {
  if (!Array.isArray(coords) || coords.length < 2) throw new Error('OSRM /table: need >=2 coords')
  const url = `${OSRM_BASE}/table/v1/${profile}/${buildCoordsString(coords)}?annotations=${annotations}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM /table ${res.status}`)
  const data = await res.json()
  const M = (annotations === 'distance' ? data?.distances : data?.durations)
  if (!M || !Array.isArray(M) || !M.length) throw new Error('OSRM /table: empty matrix')
  return M
}
