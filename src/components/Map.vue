<template>
  <div class="map-panel" @keydown.esc="closeSuggestions">
    <!-- CONTROLS -->
    <div class="controls">
      <input
        v-model="searchQuery"
        @input="onSearchInput"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="enterActive()"
        class="autocomplete"
        placeholder="Wpisz adres"
        autocomplete="off"
      />
      <button class="locate-button" @click="locateMe">📍 Lokalizuj mnie</button>

      <!-- AUTOCOMPLETE -->
      <ul v-if="suggestions.length" class="suggestions">
        <li
          v-for="(s, i) in suggestions"
          :key="s.place_id"
          :class="{ active: i === activeIndex }"
          @mouseenter="setActive(i)"
          @mousedown.prevent="chooseSuggestion(s)"
          :title="s.display_name"
        >
          {{ s.display_name }}
        </li>
      </ul>

      <div v-if="uiMsg" class="notice">{{ uiMsg }}</div>
    </div>

    <!-- MAPA -->
    <l-map
      ref="map"
      :zoom="zoom"
      :center="[center.lat, center.lng]"
      :useGlobalLeaflet="false"
      class="map-area"
      @click="onMapClick"
    >
      <l-tile-layer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        class="map-tiles"
      />
      <l-control-scale :imperial="false" />

      <!-- PIN UŻYTKOWNIKA -->
      <l-marker
        :lat-lng="[center.lat, center.lng]"
        :draggable="true"
        :icon="userIcon"
        @moveend="onUserMarkerMove"
      />

      <!-- SKLEPY (max 20) -->
      <l-marker
        v-for="shop in shopsWithLocation"
        :key="shop.shopName + shop.lat + shop.lng"
        :lat-lng="[shop.lat, shop.lng]"
        :icon="gazetkaIcon"
        @click="selectShop(shop)"
      />
    </l-map>

    <!-- LISTA SKLEPÓW POD MAPĄ -->
    <div v-if="visibleShops.length" class="shop-list">
      <div class="shop-list__header">
        Znalezione sklepy w okolicy ({{ visibleShops.length }} z {{ totalFound }}):
      </div>
      <ul class="shop-list__items">
        <li
          v-for="s in visibleShops"
          :key="s.shopName + s.lat + s.lng"
          @click="focusShop(s)"
          :title="'Pokaż '+s.shopName"
        >
          <strong>{{ s.shopName }}</strong>
          <span class="muted">— {{ s.address || 'brak adresu' }}</span>
          <span class="distance">{{ formatMeters(s.distance) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import axios from 'axios'
import { LMap, LTileLayer, LMarker, LControlScale } from '@vue-leaflet/vue-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// naprawa domyślnych ikon Leaflet (Vite/Webpack)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

export default {
  name: 'Map',
  components: { LMap, LTileLayer, LMarker, LControlScale },
  emits: ['shop-selected'],
  setup(_, { emit }) {
    // stan mapy
    const center = ref({ lat: 52.2297, lng: 21.0122 })
    const zoom = ref(12)
    const map = ref(null)

    // ikonki
    const gazetkaIcon = L.icon({
      iconUrl: new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })
    const userIcon = L.divIcon({
      className: 'user-pin-custom',
      html: `<div class="user-pin-ring"></div>`,
      iconSize: [30, 40],
      iconAnchor: [15, 40],
      popupAnchor: [0, -40]
    });

    // UI / autocomplete
    const searchQuery = ref('')
    const suggestions = ref([])
    const activeIndex = ref(-1)
    const activeId = ref(null)
    const uiMsg = ref('')
    let debounceId = null
    let activeAbort = null

    // sklepy (max 20 + lista)
    const shopsWithLocation = ref([]) // markery (tu: max 20)
    const visibleShops = ref([])      // lista (max 20)
    const totalFound = ref(0)

    // ENV
    const NOM_BASE = import.meta.env.VITE_NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'
    const PHOTON_BASE = import.meta.env.VITE_PHOTON_BASE || 'https://photon.komoot.io'
    const OVERPASS_BASE = import.meta.env.VITE_OVERPASS_BASE || 'https://overpass-api.de/api/interpreter'
    const OVERPASS_MIRROR = import.meta.env.VITE_OVERPASS_MIRROR || 'https://overpass.kumi.systems/api/interpreter'
    const NOM_EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL || ''
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

    // helpers
    const sanitizeQuery = (raw) => (raw ? raw.trim().replace(/[,\.\s;:]+$/g, '') : '')
    const shouldWaitMoreTyping = (raw) => /[,\s]$/.test(raw || '')
    const setActive = (i) => { activeIndex.value = i; activeId.value = `sug-${i}` }

    const toRad = d => (d * Math.PI) / 180
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371000
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a =
        Math.sin(dLat/2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon/2) ** 2
      return 2 * R * Math.asin(Math.sqrt(a))
    }
    const buildAddress = (tags = {}) => {
      const parts = []
      const street = tags['addr:street']
      const house  = tags['addr:housenumber']
      const city   = tags['addr:city'] || tags['addr:town'] || tags['addr:place']
      const post   = tags['addr:postcode']
      if (street || house) parts.push([street, house].filter(Boolean).join(' '))
      if (post || city)    parts.push([post, city].filter(Boolean).join(' '))
      return parts.join(', ')
    }
    const formatMeters = (m) => (m < 950 ? `${Math.round(m)} m` : `${(m/1000).toFixed(1)} km`)

    const panTo = async (lat, lng, z = null) => {
      center.value = { lat, lng }
      if (typeof z === 'number') zoom.value = z
      await nextTick()
      const m = map.value?.leafletObject
      if (m) m.setView([lat, lng], typeof z === 'number' ? z : m.getZoom(), { animate: true })
    }

    // AUTOCOMPLETE
    const onSearchInput = () => {
      clearTimeout(debounceId)
      const raw = searchQuery.value
      const q = sanitizeQuery(raw)
      if (!q || q.length < 3 || shouldWaitMoreTyping(raw)) {
        suggestions.value = []
        activeIndex.value = -1
        if (activeAbort) activeAbort.abort()
        return
      }
      debounceId = setTimeout(fetchSuggestions, 400)
    }
    const closeSuggestions = () => { suggestions.value = []; activeIndex.value = -1 }
    const moveActive = (delta) => {
      if (!suggestions.value.length) return
      const n = suggestions.value.length
      activeIndex.value = (((activeIndex.value + delta) % n) + n) % n
      activeId.value = `sug-${activeIndex.value}`
    }
    const enterActive = () => {
      if (activeIndex.value < 0 || activeIndex.value >= suggestions.value.length) return
      chooseSuggestion(suggestions.value[activeIndex.value])
    }
    const fetchSuggestions = async () => {
      uiMsg.value = ''
      const raw = searchQuery.value
      if (shouldWaitMoreTyping(raw)) return
      const q = sanitizeQuery(raw)
      if (!q || q.length < 3) return

      if (activeAbort) activeAbort.abort()
      activeAbort = new AbortController()
      const { signal } = activeAbort

      const { lat, lng } = center.value
      const d = 0.2
      const viewbox = [lng - d, lat - d, lng + d, lat + d].join(',')

      try {
        const p = new URLSearchParams({
          format: 'jsonv2',
          limit: '8',
          'accept-language': 'pl',
          q,
          countrycodes: 'pl',
          addressdetails: '1',
          autocomplete: '1',
          viewbox,
          bounded: '1'
        })
        if (NOM_EMAIL) p.append('email', NOM_EMAIL)
        const res = await fetch(`${NOM_BASE}/search?${p}`, { headers: { Accept: 'application/json' }, signal })
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
        suggestions.value = await res.json()
        activeIndex.value = suggestions.value.length ? 0 : -1
        activeId.value = activeIndex.value >= 0 ? `sug-${activeIndex.value}` : null
        activeAbort = null
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }

      try {
        const url = `${PHOTON_BASE}/api?q=${encodeURIComponent(q)}&lang=pl&limit=8&lat=${lat}&lon=${lng}`
        const res = await fetch(url, { signal })
        if (!res.ok) throw new Error(`Photon HTTP ${res.status}`)
        const data = await res.json()
        suggestions.value = (data.features || []).map(f => ({
          place_id: f.properties.osm_id || `${f.geometry.coordinates.join(',')}`,
          display_name: f.properties.name
            ? `${f.properties.name}, ${f.properties.city || f.properties.county || ''} ${f.properties.country || ''}`.trim()
            : (f.properties.street || 'Lokalizacja'),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        }))
        activeIndex.value = suggestions.value.length ? 0 : -1
        activeId.value = activeIndex.value >= 0 ? `sug-${activeIndex.value}` : null
      } catch {
        suggestions.value = []
        uiMsg.value = 'Nie można pobrać podpowiedzi adresu. Dokończ pisanie lub spróbuj ponownie.'
      } finally {
        activeAbort = null
      }
    }
    const chooseSuggestion = async (s) => {
      closeSuggestions()
      searchQuery.value = s.display_name
      const lat = parseFloat(s.lat)
      const lng = parseFloat(s.lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        await panTo(lat, lng, 13)
        fetchShopLocations()
      } else {
        uiMsg.value = 'Nie udało się ustawić widoku dla tej sugestii.'
      }
    }

    // GEOLOC
    const locateMe = async () => {
      uiMsg.value = ''
      const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      const isHttps = location.protocol === 'https:'
      if (!isLocalhost && !isHttps) {
        uiMsg.value = 'Dla lokalizacji użyj HTTPS lub uruchom na http://localhost.'
        return
      }
      if (!('geolocation' in navigator)) {
        uiMsg.value = 'Twoja przeglądarka nie wspiera geolokalizacji.'
        return
      }
      try {
        if (navigator.permissions?.query) {
          const status = await navigator.permissions.query({ name: 'geolocation' })
          if (status.state === 'denied') {
            uiMsg.value = 'Dostęp do lokalizacji zablokowany – włącz uprawnienia w przeglądarce.'
            return
          }
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords
            await panTo(lat, lng, 13)
            fetchShopLocations()
          },
          (err) => {
            uiMsg.value =
              err.code === 1 ? 'Odmowa dostępu do lokalizacji.' :
              err.code === 2 ? 'Nie można ustalić lokalizacji.' :
              err.code === 3 ? 'Przekroczono czas oczekiwania.' :
              `Błąd lokalizacji: ${err.message || 'nieznany'}`
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        )
      } catch {
        uiMsg.value = 'Wystąpił błąd geolokalizacji.'
      }
    }

    // MAP HANDLERS
    const onMapClick = async (e) => {
      const { lat, lng } = e.latlng || {}
      if (typeof lat === 'number' && typeof lng === 'number') {
        await panTo(lat, lng, null)
        fetchShopLocations()
      }
    }
    const onUserMarkerMove = async (e) => {
      const ll = e.target.getLatLng()
      await panTo(ll.lat, ll.lng, null)
      fetchShopLocations()
    }
    const focusShop = async (s) => {
      await panTo(s.lat, s.lng)
    }

    // OVERPASS — pobieranie sklepów (sort + limit 20)
    const fetchShopLocations = async () => {
      try {
        const { data: allShops } = await axios.get(`${API_BASE}/shops`)
        const R_METERS = 5000
        const brands = allShops.map(s => s.shopName?.trim()).filter(Boolean)
        if (!brands.length) { shopsWithLocation.value = []; visibleShops.value = []; totalFound.value = 0; return }

        const brandRegex = brands.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
        const query = `
          [out:json][timeout:25];
          (
            node(around:${R_METERS},${center.value.lat},${center.value.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
            way(around:${R_METERS},${center.value.lat},${center.value.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
            relation(around:${R_METERS},${center.value.lat},${center.value.lng})[shop][~"^(brand|name)$"~"${brandRegex}",i];
          );
          out center tags;
        `.trim()

        let res = await fetch(OVERPASS_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ data: query })
        })
        if (!res.ok) {
          res = await fetch(OVERPASS_MIRROR, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: new URLSearchParams({ data: query })
          })
        }
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`)
        const json = await res.json()

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
          found.push({ shopName: matched, lat, lng: lon, address })
        }

        // dedupe
        const uniq = new Map()
        for (const s of found) uniq.set(`${s.shopName}|${s.lat}|${s.lng}`, s)
        const deduped = Array.from(uniq.values())

        // dystans + sort + limit
        for (const s of deduped) {
          s.distance = haversine(center.value.lat, center.value.lng, s.lat, s.lng)
        }
        deduped.sort((a,b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))

        totalFound.value = deduped.length
        visibleShops.value = deduped.slice(0, 20)
        shopsWithLocation.value = visibleShops.value // markery = max 20
      } catch (error) {
        console.error('Błąd pobierania sklepów/Overpass:', error)
      }
    }

    const selectShop = (shop) => {
      emit('shop-selected', { shopName: shop.shopName, url: shop.url || '' })
    }

    onMounted(async () => {
      await nextTick()
      const m = map.value?.leafletObject
      if (m) m.invalidateSize()
    })

    return {
      center, zoom, map,
      gazetkaIcon, userIcon,
      searchQuery, suggestions, activeIndex, activeId, uiMsg,
      onSearchInput, moveActive, enterActive, setActive, closeSuggestions,
      chooseSuggestion, locateMe,
      onMapClick, onUserMarkerMove, selectShop, focusShop,
      shopsWithLocation, visibleShops, totalFound, formatMeters
    }
  }
}
</script>

<style scoped>
:root {
  --accent: #819067;
  --accent-2: #5e8b7e;
  --text: #1f2937;
  --muted: #6b7280;
  --border: #d1d5db;
}

/* PANEL */
.map-panel {
  position: relative;
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* MAPA */
.map-area { width: 100%; height: 460px; flex-grow: 1; }

/* KONTROLKI */
.controls {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid #ccc;
  z-index: 5000;
}
.autocomplete {
  flex: 1 1 320px; min-width: 220px;
  padding: 12px 14px; font-size: 16px;
  border: 1px solid var(--border); border-radius: 8px;
  background: #fff; color: var(--text); outline: none;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.autocomplete::placeholder { color: var(--muted); }
.autocomplete:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .18);
  background: #fff;
}
.locate-button {
  background-color: var(--accent);
  color: white; border: none; border-radius: 8px;
  padding: 0 16px; font-size: 16px; font-weight: bold;
  height: 48px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  cursor: pointer; transition: background-color .3s ease, transform .2s ease;
}
.locate-button:hover { background-color: #76845e; transform: translateY(-2px); }
.locate-button:active { transform: translateY(1px); }

/* AUTOCOMPLETE DROPDOWN */
.suggestions {
  position: absolute; top: calc(100% + 6px); left: 0; right: 0;
  background: #fff; border-radius: 10px; box-shadow: 0 10px 24px rgba(0,0,0,.16);
  padding: 6px; margin: 0; list-style: none; z-index: 6000;
  max-height: 150px; overflow-y: auto; scrollbar-gutter: stable both-edges;
}
.suggestions li {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  color: var(--text); line-height: 1.2;
  transition: background-color .15s ease, color .15s ease;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.suggestions li + li { margin-top: 4px; }
.suggestions li.active { background: rgba(104,148,27,.12); color: #0b1957; }
.suggestions li:not(.active):hover { background: rgba(104,148,27,.08); color: #0b1957; }

.notice { margin: 6px 12px 0; color: #b42318; font-size: 14px; }

/* PIN USERA */
:deep(.leaflet-div-icon.user-pin){ background: transparent !important; border: none !important; }
:deep(.user-pin .pin-wrap){ position: relative; width:36px; height:54px; }
:deep(.user-pin .ring){
  position:absolute; left:50%; top:18px; transform:translateX(-50%);
  width:30px; height:30px; background: var(--accent-2); border-radius:50%; border:2px solid var(--accent-2);
}
:deep(.user-pin .ring)::after{
  content:""; position:absolute; left:50%; bottom:-8px; transform:translateX(-50%);
  width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent; border-top:10px solid var(--accent-2);
}
:deep(.user-pin .ring)::before{
  content:""; position:absolute; left:50%; top:50%; transform:translate(-50%, -50%);
  width:12px; height:12px; background:#fff; border-radius:50%;
}

/* LISTA SKLEPÓW */
.shop-list{ border-top:1px solid #e5e7eb; background:#fff; padding:8px 12px 12px; }
.shop-list__header{ font-weight:600; font-size:14px; color:#374151; margin-bottom:6px; }
.shop-list__items{ list-style:none; padding:0; margin:0; max-height:220px; overflow:auto; }
.shop-list__items li{ display:flex; align-items:baseline; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; }
.shop-list__items li + li{ margin-top:4px; }
.shop-list__items li:hover{ background:rgba(104,148,27,.08); }
.shop-list .muted{ color:#6b7280; }
.shop-list .distance{ margin-left:auto; color:#374151; font-variant-numeric:tabular-nums; }

/* Leaflet zoom controls poniżej dropdownu (na wszelki wypadek) */
:deep(.leaflet-control-container){ z-index: 1000; }

/* RESPONSIVE */
@media (max-width: 520px) {
  .controls { padding: 10px; gap: 10px; }
  .autocomplete { flex-basis: 100%; }
}
</style>
