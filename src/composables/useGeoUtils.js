export function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function buildAddress(tags = {}) {
  const parts = []
  const street = tags['addr:street']
  const house = tags['addr:housenumber']
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:place']
  const postcode = tags['addr:postcode']
  if (street || house) parts.push([street, house].filter(Boolean).join(' '))
  if (postcode || city) parts.push([postcode, city].filter(Boolean).join(' '))
  return parts.join(', ')
}

export function formatMeters(m) {
  if (m == null) return ''
  return m < 950 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`
}