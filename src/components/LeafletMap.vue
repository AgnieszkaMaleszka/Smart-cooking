<template>
  <l-map
    ref="map"
    class="map-area"
    style="height:460px;width:100%"
    :useGlobalLeaflet="false"
    :zoom="zoom"
    :center="[center.lat, center.lng]"
    @click="e => $emit('map-click', e.latlng)"
    @zoomend="onZoomEnd"
  >
    <l-tile-layer
      url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
      attribution='&copy; OpenStreetMap contributors &copy; <a href="https://www.jawg.io">Jawg</a>'
    />

    <l-control-scale :imperial="false" />

    <!-- Marker użytkownika (przeciągany = zmiana STARTU) -->
    <l-marker
      :lat-lng="[center.lat, center.lng]"
      :draggable="true"
      :icon="userIcon"
      @moveend="onUserMoveEnd"
    />

    <!-- Markery sklepów poza trasą -->
    <template v-if="!onlyRouteShops">
      <l-marker
        v-for="shop in shops"
        :key="shop.shopName + shop.lat + shop.lng"
        :lat-lng="[shop.lat, shop.lng]"
        :icon="shopIcon"
        @click="$emit('shop-click', shop)"
      />
    </template>

    <!-- Linia trasy -->
    <l-polyline
      v-for="(seg, idx) in routeSegments"
      :key="'route-seg-'+idx"
      :lat-lngs="seg"
      :pathOptions="routeStyle"
    />

    <!-- Waypointy (1..n) – nad wszystkim -->
    <l-marker
      v-for="(w, i) in stopsNorm"
      :key="(w.id || w.storeName || 'stop') + ':' + i"
      :lat-lng="[w.lat, w.lng]"
      :icon="getStopIcon(i+1)"
      :interactive="false"
      :zIndexOffset="1000"
    />
  </l-map>
</template>

<script setup>
import { ref, computed } from 'vue'
import { LMap, LTileLayer, LMarker, LControlScale, LPolyline } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'

const props = defineProps({
  center: { type: Object, required: true },            // { lat, lng }
  zoom:   { type: Number, default: 12 },
  shops:  { type: Array, default: () => [] },
  userIcon: { type: Object, required: true },
  shopIcon: { type: Object, required: true },

  // Trasa/punkty
  routeGeojson: { type: [Array, Object, null], default: null }, // [[lat,lng],...] lub GeoJSON
  routeStops:   { type: Array, default: () => [] },             // [{lat,lng,id?,storeName?}, ...]
  travelMode:   { type: String, default: 'walk' },              // 'walk' | 'car'

  // Gdy true — ukrywamy sklepy spoza trasy
  onlyRouteShops: { type: Boolean, default: false }
})

const emit = defineEmits(['map-click','user-moveend','shop-click','zoom-updated'])
const map = ref(null)

/* ===== Eventy ===== */
function onUserMoveEnd(e) {
  const ll = e.target.getLatLng()
  emit('user-moveend', { lat: ll.lat, lng: ll.lng })
}
function onZoomEnd(e) {
  const z = e?.target?.getZoom?.() ?? props.zoom
  emit('zoom-updated', z)
}

/* ===== Normalizacja trasy ===== */
const routeSegments = computed(() => {
  const g = props.routeGeojson
  if (!g) return []

  // 1) Tablica współrzędnych
  if (Array.isArray(g)) {
    if (g.length === 0) return []
    if (Array.isArray(g[0]) && typeof g[0][0] === 'number') return [g]
    if (Array.isArray(g[0]) && Array.isArray(g[0][0])) return g
    return []
  }

  // 2) GeoJSON (LineString / MultiLineString / Feature)
  const type = g.type || g?.geometry?.type
  const geom = g.geometry || g
  const toLatLngs = (coords) => coords.map(([lng, lat]) => [lat, lng])

  if (type === 'Feature') {
    if (!geom?.coordinates) return []
    if (geom.type === 'LineString') return [toLatLngs(geom.coordinates)]
    if (geom.type === 'MultiLineString') return geom.coordinates.map(toLatLngs)
    return []
  }
  if (type === 'LineString') return [toLatLngs(geom.coordinates)]
  if (type === 'MultiLineString') return geom.coordinates.map(toLatLngs)
  return []
})

/* ===== Styl trasy wg trybu ===== */
const routeStyle = computed(() => {
  const isCar = props.travelMode === 'car'
  return {
    className: 'ss-route',
    color: isCar ? '#2e7d32' : '#0a3c11', // Samochód = zielony, Pieszo = ciemnozielony
    weight: isCar ? 5 : 4,
    opacity: 0.95,
    dashArray: isCar ? null : '6,6',
    lineCap: 'round',
    lineJoin: 'round'
  }
})

/* ===== Waypointy (1..n) ===== */
const stopsNorm = computed(() =>
  (props.routeStops || [])
    .filter(s => s && typeof s.lat === 'number' && typeof s.lng === 'number')
)

const iconCache = new Map()
function getStopIcon(n) {
  const key = `${props.travelMode}-${n}`
  if (iconCache.has(key)) return iconCache.get(key)
  const bg = (props.travelMode === 'car') ? '#2e7d32' : '#0a3c11'
  const html = `
    <div class="route-stop" style="
      width:22px;height:22px;border-radius:50%;
      display:grid;place-items:center;
      font: 700 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,Apple Color Emoji,Segoe UI Emoji;
      color:#fff;
      background:${bg}; box-shadow:0 2px 8px rgba(0,0,0,.25);">
      ${n}
    </div>`
  const ic = L.divIcon({ className: 'route-stop-icon', html, iconSize:[22,22], iconAnchor:[11,11] })
  iconCache.set(key, ic)
  return ic
}

/* ===== Public API ===== */
function setView(lat, lng, z) {
  const m = map.value?.leafletObject
  if (!m) return
  m.setView([lat, lng], typeof z === 'number' ? z : m.getZoom(), { animate: true })
}
function invalidateSize() {
  map.value?.leafletObject?.invalidateSize()
}
defineExpose({ setView, invalidateSize })
</script>

<style scoped>
@import '../styles/map.css';
.map-area { width: 100%; height: 460px; flex-grow: 1; }

/* cień pod trasą */
:deep(.ss-route) { filter: drop-shadow(0 1px 0 rgba(10,64,12,.25)); }

/* numerki nie przechwytują klików */
:deep(.route-stop-icon) { pointer-events: none; }
</style>
