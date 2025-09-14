<template>
  <div class="smart-shopping simple">
    <aside class="lists-pane card card--elevated" aria-label="Twoje listy zakupowe">
      <header class="lists-pane__header">
        <div class="lists-pane__title">
          <h2 class="h2" style="margin:0">Twoje listy</h2>
          <span class="chip" :title="`Liczba zaznaczonych list: ${selectedListIds.length}`">
            Zaznaczone: {{ selectedListIds.length }}
          </span>
        </div>
        <div class="lists-pane__actions">
          <input
            class="input input--sm"
            v-model="listsFilter"
            placeholder="Szukaj w listach…"
            aria-label="Szukaj w listach"
          />
          <button
            class="btn btn-ghost btn--sm btn--stable"
            @click="toggleSelectAll"
            :disabled="!filteredLists.length"
            style="height: 44px;"
          >
            {{ allVisibleSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie' }}
          </button>
        </div>
      </header>

      <div class="lists-scroll">
        <TransitionGroup name="grid" tag="div" class="lists-grid" aria-live="polite">
          <ListCard
            v-for="list in filteredLists"
            :key="list.id"
            :list="list"
            :selected="isSelected(list.id)"
            :logosMap="BRAND_LOGOS"
            :defaultLogo="DEFAULT_LOGO"
            :formatPrice="formatPrice"
            :formatDate="formatDate"
            :formatWeight="formatWeight"
            :totalWeight="sumWeight(list)"
            :totalPrice="sumPrice(list)"
            @toggle="onCardClick(list.id)"
            @request-delete="openDeleteConfirm(list)"
          />
        </TransitionGroup>

        <p v-if="!filteredLists.length && !listsLoading" class="muted empty" style="padding:12px">
          Brak list do wyświetlenia.
        </p>
        <p v-if="listsLoading" class="muted empty" style="padding:12px">
          Ładuję Twoje listy…
        </p>
      </div>
    </aside>

    <main class="route-pane card card--elevated">
      <section class="route-hero">
        <div class="route-toolbar">
          <div class="toolbar-left">
            <div
              class="segmented segmented--slider"
              :style="{ '--i': modeIndex }"
              role="tablist"
              aria-label="Tryb podróży"
              :disabled="routeBuilding"
            >
              <div class="segmented__thumb" aria-hidden="true"></div>
              <button
                :class="['segmented__btn', mode==='walk' && 'is-active']"
                role="tab"
                :aria-selected="mode==='walk'"
                title="Tryb pieszy"
                @click="mode='walk'"
              ><span class="material-icons" style="font-size: 18px; margin-right: 4px;">directions_walk</span>Pieszo</button>
              <button
                :class="['segmented__btn', mode==='car' && 'is-active']"
                role="tab"
                :aria-selected="mode==='car'"
                title="Tryb samochód"
                @click="mode='car'"
              ><span class="material-icons" style="font-size: 18px; margin-right: 4px;">directions_car</span>Samochód</button>
            </div>

            <div class="segmented segmented--objectives" :disabled="routeBuilding">
              <button
                :class="['segmented__btn', objective==='shortest' && 'is-active']"
                @click="setObjective('shortest')"
                title="Najkrótsza trasa"
              >Najkrótsza</button>
              <button
                :class="['segmented__btn', objective==='light' && 'is-active']"
                @click="setObjective('light')"
                title="Najpierw lżejsze zakupy"
              >Nie dźwigamy</button>
              <button
                :class="['segmented__btn', objective==='priority' && 'is-active']"
                @click="setObjective('priority')"
                title="Uwzględnij priorytety"
              >Priorytety</button>
            </div>
          </div>

          <div class="toolbar-right">
            <span class="start-pill" :title="startLabel">Start: {{ startLabel }}</span>
            <button
              class="btn btn-primary btn--stable btn--build"
              :disabled="!selectedLists.length || routeBuilding"
              @click="buildRoute"
            >
              <span class="btn__content" :style="{ opacity: routeBuilding ? 0 : 1 }">Ułóż trasę</span>
              <span v-if="routeBuilding" class="spinner" aria-hidden="true"></span>
              <span class="sr-only" aria-live="polite">{{ routeBuilding ? 'Buduję trasę…' : '' }}</span>
            </button>
          </div>
        </div>

        <div class="route-controls" v-if="objective==='priority'">
          <div class="stack-row">
            <label class="label">Priorytety z gazetek</label>
            <div class="chip-group">
              <button
                v-for="tag in priorityTags"
                :key="tag"
                :class="['chip-btn', selectedPriorities.includes(tag) && 'is-active']"
                @click="togglePriority(tag)"
                style="font-weight: 700; font-size: 14px;"
              >{{ tag }}</button>
            </div>
            <small class="muted">Wybierz produkty z promocji (na podstawie Twoich list).</small>
          </div>
        </div>
      </section>

      <section
        v-if="waypoints.length"
        :class="['route-summary receipt', {'is-loading': routeBuilding}]"
        aria-label="Plan trasy"
      >
        <header class="route-summary__header">
          <strong>Plan trasy</strong>
          <small class="muted">Start: {{ startLabel }}</small>
        </header>
        <div class="route-summary__body">
          <TransitionGroup name="chain" tag="div" class="chain" aria-live="polite">
            <!-- START -->
            <div class="chain__item chain__item--start" key="__start" :title="'Punkt startowy'">
              <div class="step-dot step-dot--start" aria-hidden="true">S</div>
              <span class="name">{{ startLabel }}</span>
            </div>
            <div v-if="waypoints.length" class="chain__arrow" aria-hidden="true">→</div>

            <!-- SKLEPY (dystans od poprzedniego: dla pierwszego = od STARTU) -->
            <template v-for="(w, idx) in waypoints" :key="w.id">
              <div class="chain__item" :title="`Sklep ${idx+1}`">
                <div class="step-dot" aria-hidden="true">{{ idx+1 }}</div>
                <img :src="w.logoUrl" :alt="w.storeName" width="20" height="20" />
                <span class="name">{{ w.storeName }}</span>
                <small class="muted" :title="`Dystans z poprzedniego punktu: ${formatKm(stepDistances[idx])}`">
                  · {{ formatKm(stepDistances[idx]) }}
                </small>
              </div>
              <div v-if="idx < waypoints.length - 1" class="chain__arrow" aria-hidden="true">→</div>
            </template>
          </TransitionGroup>
        </div>
      </section>

      <section class="map-controls" role="region" aria-label="Ustaw punkt startowy">
        <ControlsAutocomplete
          v-model:query="searchQuery"
          :center="center"
          :nominatim-base="NOM_BASE"
          :photon-base="PHOTON_BASE"
          :nominatim-email="NOM_EMAIL"
          @chosen="onSuggestionChosen"
          @locate="onLocate"
          @close="() => {}"
        />
      </section>

      <section class="map-pane">
        <div v-if="uiMsg" class="notice notice--float fade-pop" role="status" aria-live="polite">
          {{ uiMsg }}
        </div>

        <LeafletMap
          ref="mapRef"
          class="map-area"
          :center="center"
          :zoom="zoom"
          :shops="shopsWithLocation"
          :user-icon="userIcon"
          :shop-icon="gazetkaIcon"
          :route-geojson="routeGeo"
          :route-stops="waypoints"
          :travel-mode="mode"
          :only-route-shops="true"
          @map-click="onMapInteraction"
          @user-moveend="onUserMoveEnd"
          @shop-click="onShopClick"
          @zoom-updated="onZoomUpdated"
        />
      </section>

      <div class="sr-only" aria-live="polite">{{ liveMessage }}</div>
    </main>

    <ConfirmDeleteModal
      :open="confirmDeleteOpen"
      :list="deleteTargetPreview"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import L from 'leaflet'
import ControlsAutocomplete from '../components/ControlsAutocomplete.vue'
import LeafletMap from '../components/LeafletMap.vue'
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal.vue'
import ListCard from '../components/lists/ListCard.vue'

import { useOverpass } from '../composables/useOverpass.js'
import { useShoppingLists } from '../features/lists/useShoppingLists.js'
import { useRouting } from '../features/routing/useRouting.js'
import { formatKm, formatMinutes, formatPrice, formatDate, formatWeight } from '../composables/useFormatters.js'
import 'leaflet/dist/leaflet.css'

/* LOGO */
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
  Żabka: new URL('../assets/logos/Zabka.png', import.meta.url).href,
  Gazetka: new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href
}
const DEFAULT_LOGO = new URL('../assets/logos/default-shop.png', import.meta.url).href
const GAZETKA_LOGO = new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href

/* ENV */
const NOM_BASE = import.meta.env.VITE_NOMINATIM_BASE || 'https://nominatim.openstreetmap.org'
const PHOTON_BASE = import.meta.env.VITE_PHOTON_BASE || 'https://photon.komoot.io'
const OVERPASS_BASE = import.meta.env.VITE_OVERPASS_BASE || 'https://overpass-api.de/api/interpreter'
const OVERPASS_MIRROR = import.meta.env.VITE_OVERPASS_MIRROR || 'https://overpass.kumi.systems/api/interpreter'
const NOM_EMAIL = import.meta.env.VITE_NOMINATIN_EMAIL || import.meta.env.VITE_NOMINATIM_EMAIL || ''
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

/* MAPA – reactive */
const center = ref({ lat: 52.2297, lng: 21.0122 })
const zoom = ref(12)
const mapRef = ref(null)
const uiMsg = ref('')
const searchQuery = ref('')
const userLocation = ref(null)

/* Leaflet icons (fallback dla wbudowanych markerów) */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})
const gazetkaIcon = L.divIcon({
  className: 'shop-pin',
  html: `<img src="${new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href}" alt="Sklep" />`,
  iconSize: [40, 40], iconAnchor: [20, 20]
})
const userIcon = L.divIcon({
  className: 'leaflet-div-icon user-pin',
  html: `<div class="pin-wrap" aria-hidden="true"><div class="pulse"></div><div class="ring"></div><div class="dot"></div><div class="shadow"></div></div>`,
  iconSize: [36, 54], iconAnchor: [18, 50], popupAnchor: [0, -46]
})

/* Sklepy z Overpass */
const shopsWithLocation = ref([])
const shopsLoading = ref(false)
const lastFetchedCenter = ref(null)
const { fetchShopsAround, findNearestShopForBrand } = useOverpass({
  overpassBase: OVERPASS_BASE, overpassMirror: OVERPASS_MIRROR, apiBase: API_BASE
})
function withLogo(s) {
  return { ...s, logoUrl: (s.shopName === 'Gazetka' ? GAZETKA_LOGO : BRAND_LOGOS[s.shopName]) || DEFAULT_LOGO }
}

/* Debounce */
let debounceTimer = null
function debounce(fn, t) { return (...args) => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fn(...args), t) } }

/* Geo helpers */
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity
  const R = 6371e3
  const φ1 = lat1 * Math.PI/180, φ2 = lat2 * Math.PI/180
  const Δλ = (lon2 - lon1) * Math.PI/180
  const d = Math.acos(Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2)*Math.cos(Δλ)) * R
  return isNaN(d) ? 0 : d
}

/* Odświeżanie listy sklepów */
const debouncedRefreshShops = debounce(refreshShops, 700)
async function refreshShops() {
  if (shopsLoading.value) return
  shopsLoading.value = true
  uiMsg.value = ''
  try {
    const { results, total } = await fetchShopsAround({ center: center.value, zoom: zoom.value })
    shopsWithLocation.value = results.map(withLogo)
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
  const dist = getDistance(lat, lng, lastFetchedCenter.value?.lat, lastFetchedCenter.value?.lng)
  let threshold = 5000
  if (zoom.value > 11) threshold = 2500
  if (zoom.value > 13) threshold = 1000
  if (dist > threshold) debouncedRefreshShops()
}
function onZoomUpdated(newZoom) {
  const oldZoom = zoom.value
  zoom.value = newZoom
  if ((oldZoom <= 11 && newZoom > 11) || (oldZoom <= 13 && newZoom > 13) ||
      (oldZoom > 11 && newZoom <= 11) || (oldZoom > 13 && newZoom <= 13)) {
    debouncedRefreshShops()
  }
}

/* ▼ NOWE: start = pinezka / adres */
async function onUserMoveEnd({ lat, lng }) {
  center.value = { lat, lng }
  userLocation.value = { lat, lng }
  setStartFromGeo(lat, lng)             // <-- ustaw nowy START
  await refreshShops()
  if (selectedLists.value.length) await buildRoute()
}

async function onSuggestionChosen({ lat, lon }) {
  const la = parseFloat(lat), lo = parseFloat(lon)
  await panTo(la, lo, 14)
  setStartFromGeo(la, lo)               // <-- ustaw START na wskazany adres
  await refreshShops()
  if (selectedLists.value.length) await buildRoute()
}

async function onLocate({ lat, lng, accuracy, error }) {
  if (error) { uiMsg.value = error; return }
  userLocation.value = { lat, lng }
  setStartFromGeo(lat, lng)             // <-- ustaw START
  await panTo(lat, lng, 14)
  await refreshShops()
  if (selectedLists.value.length) await buildRoute()
}

const panTo = async (lat, lng, z=null) => {
  if (typeof z === 'number') zoom.value = z
  center.value = { lat, lng }
  await nextTick()
  mapRef.value?.setView(lat, lng, z)
}
function onShopClick(shop) { panTo(shop.lat, shop.lng, 16) }

/* LISTY – composable */
const {
  listsLoading, lists, listsFilter, filteredLists,
  selectedListIds, selectedLists, allVisibleSelected,
  refreshUserLists, toggleList, toggleSelectAll,
  deleteLists, deleteListsByIds,
  isSelected, sumPrice, sumWeight, savingsPotential,
} = useShoppingLists({ logosMap: BRAND_LOGOS, defaultLogo: DEFAULT_LOGO })

/* Handlery kart list po stronie tego komponentu */
function onCardClick(id) { toggleList(id); if (selectedLists.value.length) buildRoute() }

/* === ROUTE GEO + OSRM (wstrzykujemy do useRouting) === */
// fetchOsrmRoute przeniesione do features/routing/osrm.js

/* ROUTING – composable + strategie */
const {
  objective, mode, modeIndex, selectedPriorities,
  routeStart, startSource, startLabel,
  waypoints, routeGeo, routeStats, routeBuilding, liveMessage, stepDistances,
  buildRoute, clearRoute, setStartFromGeo,
  priorityTags, togglePriority, setObjective
} = useRouting({
  BRAND_LOGOS, DEFAULT_LOGO,
  findNearestShopForBrand,
  shopsWithLocation,
  selectedLists,
  centerRef: center,
  panTo,
})

/* Usuwanie – modal */
const confirmDeleteOpen = ref(false)
const deleteTargetPreview = ref(null)
function openDeleteConfirm(list) { deleteTargetPreview.value = list; confirmDeleteOpen.value = true }
function cancelDelete() { confirmDeleteOpen.value = false; deleteTargetPreview.value = null }
async function confirmDelete() {
  const target = deleteTargetPreview.value
  if (!target) { cancelDelete(); return }
  const ok = await deleteLists([target])
  cancelDelete()
  if (!ok) { console.warn('[delete] Nic nie usunięto'); uiMsg.value = 'Nie udało się usunąć listy. Zobacz konsolę.' }
}

/* Init */
onMounted(async () => {
  await nextTick()
  mapRef.value?.invalidateSize()
  await refreshUserLists()

  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('flyerSelections:')) refreshUserLists()
  })

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        userLocation.value = { lat, lng };
        setStartFromGeo(lat, lng);
        await onLocate({ lat, lng, accuracy: pos.coords.accuracy });
        if (selectedLists.value.length) await buildRoute();
      },
      async () => {
        await refreshShops();
        if (selectedLists.value.length) await buildRoute();
      },
      { timeout: 7000, enableHighAccuracy: false }
    )
  } else {
    await refreshShops()
    if (selectedLists.value.length) await buildRoute()
  }
})
</script>

<style scoped>
@import '../styles/map.css';

.smart-shopping.simple {
  display: grid;
  grid-template-columns: clamp(620px, 64vw, 860px) 1fr;
  gap: var(--space-6);
  padding: var(--space-6);
  align-items: stretch;
}

/* LEWY PANEL */
.lists-pane {
  display: grid; grid-template-rows: auto 1fr;
  height: calc(100vh - (var(--space-6) * 2));
  border-radius: calc(var(--radius-lg) * 1.25);
  border: 1px solid rgba(10,64,12,.12);
  overflow: hidden;
  background: linear-gradient(0deg, rgba(255,255,255,.98), rgba(255,255,255,.98)), var(--color-paper);
}
.lists-pane__header {
  position: sticky; top: 0; z-index: 2;
  padding: 14px; background: #fff;
  border-bottom: 1px solid rgba(10,64,12,.12);
  display: grid; gap: 10px;
}
.lists-pane__title { display:flex; align-items:center; gap:10px; }
.chip {
  display:inline-flex; align-items:center; height: 26px; padding: 0 10px;
  border-radius: 999px; background: rgba(10,64,12,.06); color: var(--color-ink); font-weight: 800; font-size: 12px;
}
.lists-pane__actions { display:flex; gap:8px; align-items:center; }
.input--sm {
  height: 44px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(10,64,12,0.2);
  background: #fff;
  box-shadow: inset 0 1px 0 rgba(10,64,12,0.04);
  color: var(--color-ink);
  outline: none;
  transition: border-color var(--transition-1), box-shadow var(--transition-1), background-color var(--transition-1);
}
.input--sm::placeholder { color: rgba(10,64,12,0.5); }
.input--sm:focus {
  box-shadow: none !important;
  outline: none !important;
  border-color: rgba(10,64,12,.34);
  border-radius: 999px !important;
}
.lists-scroll { overflow-y: auto; padding: 16px; background: var(--color-paper); }
.lists-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }

/* PRAWA KOLUMNA */
.route-pane {
  display: grid; grid-template-rows: auto auto auto auto 1fr;
  height: calc(100vh - (var(--space-6) * 2));
  border-radius: calc(var(--radius-lg) * 1.25);
  border: 1px solid rgba(10,64,12,.12);
  overflow: hidden;
  background: linear-gradient(0deg, rgba(255,255,255,.98), rgba(255,255,255,.98)), var(--color-paper);
}

.route-hero {
  padding: 16px; display: grid; gap: 12px;
  background: radial-gradient(1200px 300px at 50% -10%, rgba(104,148,27,.10), transparent),
              linear-gradient(0deg, rgba(255,255,255,.96), rgba(255,255,255,.96)), var(--color-paper);
  border-bottom: 1px solid rgba(10,64,12,.12);
}
.route-toolbar {
  display:flex; align-items:center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap;
}
.toolbar-left { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
.toolbar-right { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
.start-pill {
  display:inline-flex; align-items:center; height: 28px; padding: 0 10px;
  border-radius: 999px; background: rgba(10,64,12,.06); color: var(--color-ink); font-weight: 800; font-size: 12px;
}

/* Segmented */
.segmented { display: inline-flex; gap: 4px; padding: 4px; background: rgba(10,64,12,0.02); border: 1px solid rgba(10,64,12,0.06); border-radius: 999px;  box-shadow: none; }
.segmented--objectives { padding: 4px; }
.segmented__btn {
  appearance:none; border:0; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: transparent; color: var(--color-ink); font-weight: 700;
  font-size: 14px; transition: background-color var(--transition-1), transform var(--transition-1), color var(--transition-1);
}
.segmented__btn:hover { background: rgba(10,64,12,0.04); }
.segmented__btn.is-active { background: var(--color-ink); color: #fff; box-shadow: 0 4px 10px rgba(10,64,12,.1); }

.segmented--slider { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; overflow: hidden; }
.segmented--slider .segmented__thumb {
  position: absolute; z-index: 0; top: 4px; left: 4px; bottom: 4px; width: calc(50% - 4px);
  border-radius: 999px; background: var(--color-ink); box-shadow: 0 4px 10px rgba(10,64,12,.1);
  transform: translateX(calc(var(--i, 0) * (100% + 4px)));
  transition: transform .24s cubic-bezier(.2,.7,.2,1), background-color var(--transition-1);
}
.segmented--slider .segmented__btn { position: relative; z-index: 1; }

/* Chipy */
.chip-group { display: flex; gap: 8px; flex-wrap: wrap; }
.chip-btn {
  appearance: none; border: 0; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: rgba(10,64,12,0.02); color: var(--color-ink); font-weight: 700; font-size: 14px;
  transition: background-color var(--transition-1), color var(--transition-1), box-shadow var(--transition-1);
  box-shadow: none;
}
.chip-btn:hover { background: rgba(10,64,12,0.04); }
.chip-btn.is-active { background: var(--color-ink); color: #fff; box-shadow: 0 4px 10px rgba(10,64,12,.1); }

/* Paragon trasy */
.route-summary { position: relative; margin: 12px; background: #fff; border: 1px dashed rgba(10,64,12,.18); border-radius: 14px; box-shadow: var(--shadow-soft); padding: 12px 14px; }
.route-summary.is-loading { position: relative; overflow: hidden; }
.route-summary.is-loading::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
  transform: translateX(-100%); animation: shimmer 1.5s infinite;
}
.route-summary.is-loading .route-summary__body,
.route-summary.is-loading .route-summary__header { opacity: 0.5; }
.route-summary.receipt::before,
.route-summary.receipt::after {
  content: ""; position: absolute; left: 0; right: 0; height: 12px; z-index: 1; pointer-events: none;
  background-size: 24px 12px; background-repeat: repeat-x;
}
.route-summary.receipt::before { top: -6px; background-image: radial-gradient(circle at 12px 6px, transparent 6px, #fff 6px); }
.route-summary.receipt::after { bottom: -6px; background-image: radial-gradient(circle at 12px 6px, transparent 6px, #fff 6px); }
.route-summary__header { display:flex; align-items:center; justify-content: space-between; margin-bottom: 8px; }
.chain { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
.chain__item { display:flex; align-items:center; gap: 6px; background: rgba(10,64,12,.03); padding: 6px 10px; border-radius: 999px; }
.chain__item--start { background: rgba(46,125,50,.08); }
.chain__arrow { opacity: .6; }
.step-dot { width: 20px; height: 20px; border-radius: 50%; background: rgba(104,148,27,.18); color: #0a3c11; font-weight: 900; font-size: 12px; display:grid; place-items:center; }
.step-dot--start { background: rgba(104,148,27,.18); color:#0a3c11; }

/* MAPA */
.map-pane { position: relative; flex: 1 1 auto; height: 100%; min-height: 360px; background: var(--color-paper); }
.map-pane .map-area { height: 100%; border-radius: 0; border: 0; }

/* Notice */
.notice--float { position: absolute; top: 56px; left: 12px; z-index: 4000; margin: 0; }

/* Przyciski stabilne */
.btn--stable { height: 44px; min-width: 120px; display: inline-flex; align-items: center; justify-content: center; transform: none !important; font-weight: 700; font-size: 14px; }
.btn--build { position: relative; }
.btn--build .spinner{ position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255,255,255,.6); border-top-color: #fff; animation: btnspin .9s linear infinite; }
@keyframes btnspin{ 0%{ transform: translate(-50%, -50%) rotate(0deg);} 100%{ transform: translate(-50%, -50%) rotate(360deg);} }
.btn__content { display: inline-block; transition: opacity .18s ease; }

/* Animacje */
.grid-enter-from, .grid-leave-to { opacity: 0; transform: translateY(6px) scale(.98); }
.grid-enter-active, .grid-leave-active { transition: .22s ease; }
.grid-move { transition: transform .22s ease; }
.chain-enter-from, .chain-leave-to { opacity: 0; transform: translateY(6px); }
.chain-enter-active, .chain-leave-active { transition: .22s ease; }

/* Modal potwierdzenia (jest w osobnym komponencie) */

/* RWD */
@media (max-width: 1080px) {
  .smart-shopping.simple {
    grid-template-columns: 1fr;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  .lists-pane, .route-pane { height: auto; }
  .lists-grid { grid-template-columns: 1fr; }
  .map-pane { min-height: 420px; }
}

/* Accessibility helpers */
.visually-hidden, .sr-only {
  position:absolute !important;
  width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}
.empty { text-align: center; }
</style>
