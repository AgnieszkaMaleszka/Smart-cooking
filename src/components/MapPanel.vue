<template>
  <div class="map-panel card card--elevated" @keydown.esc="closeSuggestions">
    <ControlsAutocomplete
      v-model:query="searchQuery"
      :center="center"
      :nominatim-base="NOM_BASE"
      :photon-base="PHOTON_BASE"
      :nominatim-email="NOM_EMAIL"
      @chosen="onSuggestionChosen"
      @locate="onLocate"
      @close="closeSuggestions"
    />

    <div v-if="uiMsg" class="notice">{{ uiMsg }}</div>

    <LeafletMap
      ref="mapRef"
      :center="center"
      :zoom="zoom"
      :shops="shopsWithLocation"
      :user-icon="userIcon"
      :shop-icon="gazetkaIcon"

      :route-geojson="routeGeo"
      :route-stops="routeStops"
      :travel-mode="travelMode"

      @map-click="onMapInteraction"
      @user-moveend="onMapInteraction"
      @shop-click="selectShop"
      @zoom-updated="onZoomUpdated"
    />

    <ShopList
      :shops="visibleShops"
      :total-found="totalFound"
      :format-meters="formatMeters"
      :loading="shopsLoading"
      @focus="onFocusShop"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import L from 'leaflet'
import ControlsAutocomplete from './ControlsAutocomplete.vue'
import LeafletMap from './LeafletMap.vue'
import ShopList from './ShopList.vue'
import { useOverpass } from '../composables/useOverpass.js'
import { formatMeters } from '../composables/useGeoUtils.js'
import 'leaflet/dist/leaflet.css'

/* ===================== PROPS ===================== */
const props = defineProps({
  /** Zaznaczone listy (gazetki) – z nich budujemy trasę */
  selectedLists: { type: Array, default: () => [] },
  /** 'walk' | 'car' (kolor trasy + profil OSRM) */
  travelMode: { type: String, default: 'walk' },
  /** Opcjonalny punkt startu {lat, lng}. Gdy brak – bierzemy centrum mapy */
  start: { type: Object, default: null }
})

const emit = defineEmits(['shop-selected'])

/* ===================== STAŁE / IKONY ===================== */
const BRAND_LOGOS = {
  Biedronka: new URL('../assets/logos/Biedronka.png', import.meta.url).href,
  Carrefour: new URL('../assets/logos/Carrefour.png', import.meta.url).href,
  CarrefourExpress: new URL('../assets/logos/CarrefourExpress.png', import.meta.url).href,
  Castorama: new URL('../assets/logos/Castorama.png', import.meta.url).href,
  Dino: new URL('../assets/logos/Dino.png', import.meta.url).href,
  Empik: new URL('../assets/logos/Empik.png', import.meta.url).href,
  Kaufland: new URL('../assets/logos/Kaufland.png', import.meta.url).href,
  Leclerc: new URL('../assets/logos/Leclerc.png', import.meta.url).href,
  Lidl: new URL('../assets/logos/Lidl.png', import.meta.url).href,
  Netto: new URL('../assets/logos/Netto.png', import.meta.url).href,
  Pepco: new URL('../assets/logos/pepco.png', import.meta.url).href,
  PoloMarket: new URL('../assets/logos/PoloMarket.png', import.meta.url).href,
  Rossmann: new URL('../assets/logos/Rossmann.png', import.meta.url).href,
  TwójMarket: new URL('../assets/logos/TwojMarket.png', import.meta.url).href,
  Żabka: new URL('../assets/logos/Zabka.png', import.meta.url).href
}
const DEFAULT_LOGO = new URL('../assets/logos/default-shop.png', import.meta.url).href
const withLogo = s => ({ ...s, logoUrl: BRAND_LOGOS[s.shopName] || DEFAULT_LOGO })

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})
const userIcon = L.divIcon({
  className: 'leaflet-div-icon custom-user-pin',
  html: `<div class="pin-base"></div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40]
})
const gazetkaIcon = L.divIcon({
  className: 'leaflet-div-icon custom-shop-pin',
  html: `<img src="${new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href}" alt="Gazetka" style="width: 32px; height: 32px;"/>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32]
})

/* ===================== ENV ===================== */
const NOM_BASE = import.meta.env.VITE_NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'
const PHOTON_BASE = import.meta.env.VITE_PHOTON_BASE || 'https://photon.komoot.io'
const OVERPASS_BASE = import.meta.env.VITE_OVERPASS_BASE || 'https://overpass-api.de/api/interpreter'
const OVERPASS_MIRROR = import.meta.env.VITE_OVERPASS_MIRROR || 'https://overpass.kumi.systems/api/interpreter'
const NOM_EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL || ''
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

/* ===================== STAN MAPY ===================== */
const center = ref({ lat: 52.2297, lng: 21.0122 })
const zoom = ref(12)
const mapRef = ref(null)
const uiMsg = ref('')

/* Sklepy */
const shopsWithLocation = ref([])
const visibleShops = ref([])
const totalFound = ref(0)
const shopsLoading = ref(false)
const lastFetchedCenter = ref(null)

/* Wyszukiwarka */
const searchQuery = ref('')

/* Trasa */
const routeStops = ref([]) // ułożone przystanki (sklepy)
const routeGeo   = ref(null) // GeoJSON LineString
const routeBuilding = ref(false)

/* ===================== Overpass ===================== */
const { fetchShopsAround, findNearestShopForBrand } = useOverpass({
  overpassBase: OVERPASS_BASE,
  overpassMirror: OVERPASS_MIRROR,
  apiBase: API_BASE
})

/* ===================== UTILS ===================== */
let debounceTimer = null
function debounce(func, delay) {
  return function(...args) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => func.apply(this, args), delay)
  }
}

// Wielki okrąg – metry
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity
  const R = 6371e3
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180
  const Δλ = (lon2 - lon1) * Math.PI/180
  const d = Math.acos(Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2)*Math.cos(Δλ)) * R
  return isNaN(d) ? 0 : d
}
function orderNearestNeighbor(points, start) {
  if (points.length <= 1) return points
  const pool = [...points]
  const ordered = []
  let cur = { ...start }
  while (pool.length) {
    let bestIdx = 0
    let bestD = Infinity
    for (let i=0;i<pool.length;i++) {
      const p = pool[i]
      const d = getDistance(cur.lat, cur.lng, p.lat, p.lng)
      if (d < bestD) { bestD = d; bestIdx = i }
    }
    const next = pool.splice(bestIdx,1)[0]
    ordered.push(next)
    cur = { lat: next.lat, lng: next.lng }
  }
  return ordered
}

// OSRM
async function fetchOsrmRoute(points, profile /* 'walking'|'driving' */) {
  if (!Array.isArray(points) || points.length < 2) return null
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error('OSRM error: ' + res.status)
  const data = await res.json()
  if (!data?.routes?.length) throw new Error('OSRM no routes')
  const r = data.routes[0]
  return { geojson: r.geometry, distance: Number(r.distance||0), duration: Number(r.duration||0) }
}

function straightLineGeo(points) {
  return { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) }
}

/* ===================== REFRESH SKLEPÓW ===================== */
const debouncedRefreshShops = debounce(refreshShops, 750)

async function refreshShops() {
  if (shopsLoading.value) return
  shopsLoading.value = true
  uiMsg.value = ''
  try {
    const { results, total } = await fetchShopsAround({ center: center.value, zoom: zoom.value })
    const enhanced = results.map(withLogo)
    visibleShops.value = enhanced
    totalFound.value = total
    shopsWithLocation.value = enhanced
    if (total === 0) uiMsg.value = 'W tym obszarze nie znaleziono sklepów z promocjami.'
    lastFetchedCenter.value = { ...center.value }
  } catch (e) {
    console.error(e)
    uiMsg.value = 'Błąd pobierania sklepów. Spróbuj ponownie później.'
  } finally {
    shopsLoading.value = false
  }
}

async function onMapInteraction({ lat, lng }) {
  center.value = { lat, lng }
  const distance = getDistance(lat, lng, lastFetchedCenter.value?.lat, lastFetchedCenter.value?.lng)
  let threshold = 5000
  if (zoom.value > 11) threshold = 2500
  if (zoom.value > 13) threshold = 1000
  if (distance > threshold) debouncedRefreshShops()
}

function onZoomUpdated(newZoom) {
  const oldZoom = zoom.value
  zoom.value = newZoom
  if ((oldZoom <= 11 && newZoom > 11) || (oldZoom <= 13 && newZoom > 13) ||
      (oldZoom > 11 && newZoom <= 11) || (oldZoom > 13 && newZoom <= 13)) {
    debouncedRefreshShops()
  }
}

/* ===================== START PUNKT ===================== */
const startLatLng = computed(() => {
  if (props.start && typeof props.start.lat === 'number' && typeof props.start.lng === 'number') return props.start
  return center.value
})

/* ===================== BUDOWA PRZYSTANKÓW Z LIST ===================== */
function nearestByName(name, refPoint) {
  // bierzemy najbliższy sklep o tej samej nazwie (brandzie) z już wczytanych
  const candidates = shopsWithLocation.value.filter(s => s.shopName === name)
  if (!candidates.length) return null
  let best = candidates[0]
  let bestD = getDistance(refPoint.lat, refPoint.lng, best.lat, best.lng)
  for (const c of candidates) {
    const d = getDistance(refPoint.lat, refPoint.lng, c.lat, c.lng)
    if (d < bestD) { best = c; bestD = d }
  }
  return best
}

async function buildStopsFromLists() {
  const start = startLatLng.value
  const temp = []

  for (const l of props.selectedLists) {
    const brand = l.storeName || 'Gazetka'
    let shop = nearestByName(brand, start)
    if (!shop) {
      // fallback: zapytaj serwer o najbliższy sklep tej marki
      try {
        shop = await findNearestShopForBrand({ brandName: brand, center: start })
      } catch { /* ignore */ }
    }
    if (!shop) continue

    temp.push({
      listId: l.id,
      shopId: shop.id ?? `${brand}|${shop.lat},${shop.lng}`,
      storeName: brand,
      lat: shop.lat, lng: shop.lng,
      logoUrl: BRAND_LOGOS[brand] || DEFAULT_LOGO
    })
  }

  // DEDUPE po fizycznym sklepie
  const byShop = new Map()
  for (const w of temp) {
    if (!byShop.has(w.shopId)) {
      byShop.set(w.shopId, { ...w, mergedListIds: [w.listId] })
    } else {
      const acc = byShop.get(w.shopId)
      acc.mergedListIds.push(w.listId)
    }
  }

  // Najkrótsza: NN od punktu startowego
  const unique = Array.from(byShop.values())
  return orderNearestNeighbor(unique, start)
}

/* ===================== BUDOWA TRASY (NAJKRÓTSZA) ===================== */
const debouncedBuildRoute = debounce(async () => {
  await buildRouteShortest()
}, 250)

async function buildRouteShortest() {
  try {
    routeBuilding.value = true
    // 1) przystanki
    const stops = await buildStopsFromLists()
    routeStops.value = stops

    if (stops.length < 2) {
      routeGeo.value = null
      return
    }

    // 2) OSRM profil
    const profile = props.travelMode === 'walk' ? 'walking' : 'driving'

    // 3) zapytanie OSRM, fallback do prostej linii
    try {
      const res = await fetchOsrmRoute(stops, profile)
      if (res && res.geojson) {
        routeGeo.value = res.geojson
      } else {
        routeGeo.value = straightLineGeo(stops)
      }
    } catch (e) {
      console.warn('[OSRM fallback]', e)
      routeGeo.value = straightLineGeo(stops)
    }

    // 4) dopasuj widok do pierwszego punktu (lekki zoom)
    if (stops[0]) await panTo(stops[0].lat, stops[0].lng, 13)
  } finally {
    routeBuilding.value = false
  }
}

/* ===================== HANDLERY UI ===================== */
async function onSuggestionChosen({ lat, lon }) {
  await panTo(parseFloat(lat), parseFloat(lon), 14)
  await refreshShops()
  debouncedBuildRoute()
}

async function onLocate({ lat, lng, accuracy, error }) {
  if (error) { uiMsg.value = error; return }
  await panTo(lat, lng, 14)
  await refreshShops()
  debouncedBuildRoute()
}

const panTo = async (lat, lng, z = null) => {
  if (typeof z === 'number') zoom.value = z
  center.value = { lat, lng }
  await nextTick()
  mapRef.value?.setView(lat, lng, z)
}

async function onFocusShop(shop) {
  await panTo(shop.lat, shop.lng, 16)
}

function selectShop(shop) {
  emit('shop-selected', { shopName: shop.shopName, url: shop.url || '' })
}

function closeSuggestions() {}

/* ===================== WATCHERY ===================== */
watch(() => props.selectedLists, debouncedBuildRoute, { deep: true })
watch(() => props.travelMode,  debouncedBuildRoute)
watch(shopsWithLocation,       debouncedBuildRoute)
watch(startLatLng,             debouncedBuildRoute)

/* ===================== INIT ===================== */
onMounted(async () => {
  await nextTick()
  mapRef.value?.invalidateSize()
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      err => { console.warn(`Geolocation error: ${err.message}`); uiMsg.value = 'Nie udało się ustalić lokalizacji. Wyświetlam domyślną mapę.'; refreshShops(); debouncedBuildRoute() },
      { timeout: 7000, enableHighAccuracy: false }
    )
  } else {
    refreshShops()
    debouncedBuildRoute()
  }
})
</script>

<style scoped>
@import '../styles/map.css';
.notice {
  text-align: center;
  padding: 8px;
  background-color: #f8f9fa;
  color: #6c757d;
  font-size: 0.9em;
  border-bottom: 1px solid #dee2e6;
}
</style>
