import axios from 'axios'
import { haversine, buildAddress } from './useGeoUtils'

export function useOverpass({ overpassBase, overpassMirror, apiBase }) {
  const R_METERS = 5000

  async function getBrands() {
    const { data } = await axios.get(`${apiBase}/shops`) // [{ shopName }]
    return data.map(s => s.shopName?.trim()).filter(Boolean)
  }

  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

  function buildQuery(center, brandRegex) {
    return `
      [out:json][timeout:25];
      (
        node(around:${R_METERS},${center.lat},${center.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
        way(around:${R_METERS},${center.lat},${center.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
        relation(around:${R_METERS},${center.lat},${center.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
      );
      out center tags;`.trim()
  }

  async function callOverpass(query) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second client-side timeout

    try {
      let res = await fetch(overpassBase, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal // Apply timeout signal
      })
      if (!res.ok) {
        res = await fetch(overpassMirror, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal // Apply timeout signal
        })
      }
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
      return await res.json()
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Overpass API: Przekroczono czas oczekiwania (timeout).');
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchShopsAround({ center }) {
    const brands = await getBrands()
    if (!brands.length) return { results: [], total: 0 }
    const brandRegex = brands.map(escapeRegex).join('|')
    const query = buildQuery(center, brandRegex)
    const json = await callOverpass(query)

    const elems = json.elements || []
    const found = []
    for (const el of elems) {
      const lat = el.lat || el.center?.lat
      const lon = el.lon || el.center?.lon
      if (!lat || !lon) continue
      const name = el.tags?.brand || el.tags?.name || 'Sklep'
      const matched = brands.find(b => name.toLowerCase().includes(b.toLowerCase()))
      if (!matched) continue
      const address = buildAddress(el.tags)
      found.push({ shopName: matched, lat, lng: lon, url: '', hasGazetka: true, address, _tags: el.tags })
    }

    // dedupe
    const uniq = new Map()
    for (const s of found) uniq.set(`${s.shopName}|${s.lat}|${s.lng}`, s)
    const deduped = Array.from(uniq.values())

    // distance + sort + limit
    for (const s of deduped) s.distance = haversine(center.lat, center.lng, s.lat, s.lng)
    deduped.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

    return { results: deduped.slice(0, 20), total: deduped.length }
  }

  async function findNearestShopForBrand({ brandName, center }) {
    const brandRegex = escapeRegex(brandName);
    const query = buildQuery(center, brandRegex);
    const json = await callOverpass(query);

    const elems = json.elements || [];
    if (!elems.length) return null;

    let nearestShop = null;
    let minDist = Infinity;

    for (const el of elems) {
      const lat = el.lat || el.center?.lat;
      const lon = el.lon || el.center?.lon;
      if (!lat || !lon) continue;

      const name = el.tags?.brand || el.tags?.name || 'Sklep';
      // Ensure the fetched shop name matches the requested brandName (case-insensitive)
      if (!name.toLowerCase().includes(brandName.toLowerCase())) continue;

      const distance = haversine(center.lat, center.lng, lat, lon);
      if (distance < minDist) {
        minDist = distance;
        nearestShop = { shopName: brandName, lat, lng: lon, url: '', hasGazetka: true, address: buildAddress(el.tags), _tags: el.tags };
      }
    }
    return nearestShop;
  }

  return { fetchShopsAround, findNearestShopForBrand }
}