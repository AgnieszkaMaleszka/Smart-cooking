export function useGeocoding({ nominatimBase, photonBase, nominatimEmail }) {
  function sanitizeQuery(raw) { return raw ? raw.trim().replace(/[\,.\s;:]+$/g, '') : '' }

  async function fetchNominatim({ q, around, signal }) {
    const d = 0.2
    const viewbox = [around.lng - d, around.lat - d, around.lng + d, around.lat + d].join(',')
    const p = new URLSearchParams({
      format: 'jsonv2', limit: '8', 'accept-language': 'pl', q,
      countrycodes: 'pl', addressdetails: '1', autocomplete: '1', viewbox, bounded: '1'
    })
    if (nominatimEmail) p.append('email', nominatimEmail)
    const res = await fetch(`${nominatimBase}/search?${p}`, { headers: { Accept: 'application/json' }, signal })
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    return await res.json()
  }

  async function fetchPhoton({ q, around, signal }) {
    const url = `${photonBase}/api?q=${encodeURIComponent(q)}&lang=pl&limit=8&lat=${around.lat}&lon=${around.lng}`
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
    const data = await res.json()
    return (data.features || []).map(f => ({
      place_id: f.properties.osm_id || `${f.geometry.coordinates.join(',')}`,
      display_name: f.properties.name
        ? `${f.properties.name}, ${f.properties.city || f.properties.county || ''} ${f.properties.country || ''}`.trim()
        : (f.properties.street || 'Lokalizacja'),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }))
  }

  async function fetchSuggestions({ q, around, previous }) {
    if (previous) previous.abort?.()
    const controller = new AbortController()
    const signal = controller.signal
    try {
      const list = await fetchNominatim({ q, around, signal })
      return { list, controller }
    } catch (e) {
      if (e.name === 'AbortError') return { list: [], controller: null }
      // fallback to Photon
      try {
        const list = await fetchPhoton({ q, around, signal })
        return { list, controller }
      } catch (e2) {
        if (e2.name === 'AbortError') return { list: [], controller: null }
        return { list: [], controller: null }
      }
    }
  }

  return { sanitizeQuery, fetchSuggestions }
}