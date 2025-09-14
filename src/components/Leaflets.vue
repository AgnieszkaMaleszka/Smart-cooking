<!-- GazetkiMap.vue -->
<template>
  <div class="app-shell">
    <!-- LEWA: mapa -->
    <div class="map-area">
      <!-- Twój komponent mapy – przykład z Google Maps JS API / vue3-google-map -->
      <!-- Załóżmy, że emitujesz 'marker-click' z obiektem place { id, name, ... } -->
      <MapView @marker-click="onMarkerClick" />
    </div>

    <!-- PRAWA: panel gazetek -->
    <aside class="side-panel" :class="{ open: panelOpen }">
      <header class="side-header">
        <h3 v-if="currentPlaceName">{{ currentPlaceName }}</h3>
        <button class="icon-btn" @click="closePanel" aria-label="Zamknij panel">✕</button>
      </header>

      <div class="side-content" v-if="!activeLeafletId">
        <div v-if="loading" class="state">Ładowanie gazetek…</div>
        <div v-else-if="leaflets.length === 0" class="state">Brak dostępnych gazetek.</div>

        <!-- lista miniatur (pierwsze strony) -->
        <ul class="thumb-list">
          <li v-for="lf in leaflets" :key="lf.id" class="thumb-card" @click="openLeaflet(lf.id)">
            <img
              :src="lf.pages[0]"
              :alt="`Pierwsza strona: ${lf.title}`"
              loading="lazy"
            />
            <div class="thumb-meta">
              <div class="thumb-title">{{ lf.title }}</div>
              <div class="thumb-pages">{{ lf.pages.length }} stron</div>
            </div>
          </li>
        </ul>
      </div>

      <!-- viewer jednej gazetki -->
      <div v-else class="viewer">
        <button class="back-btn" @click="closeLeaflet">← Wszystkie gazetki</button>

        <div class="viewer-header">
          <div class="viewer-title">
            {{ activeLeaflet?.title }}
            <span class="muted"> • str. {{ pageIndex + 1 }}/{{ activeLeaflet?.pages.length }}</span>
          </div>
          <div class="viewer-ctr">
            <button class="icon-btn" :disabled="pageIndex === 0" @click="prevPage" aria-label="Poprzednia strona">⟨</button>
            <button class="icon-btn" :disabled="pageIndex >= (activeLeaflet?.pages.length ?? 1) - 1" @click="nextPage" aria-label="Następna strona">⟩</button>
          </div>
        </div>

        <div class="page-wrap" @click="nextPage">
          <img
            v-if="activeLeaflet"
            :src="activeLeaflet.pages[pageIndex]"
            :alt="`Strona ${pageIndex + 1} – ${activeLeaflet.title}`"
          />
        </div>

        <!-- mini-nawigacja miniaturami -->
        <div class="page-strip" v-if="activeLeaflet">
          <button
            v-for="(p, i) in activeLeaflet.pages"
            :key="i"
            class="strip-thumb"
            :class="{ active: i === pageIndex }"
            @click.stop="goToPage(i)"
            :aria-label="`Idź do strony ${i + 1}`"
          >
            <img :src="p" :alt="`Miniatura str. ${i + 1}`" loading="lazy" />
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MapView from './MapView.vue' // <- Twój komponent mapy (podmień na właściwy import)

// --- stan UI
const panelOpen = ref(false)
const loading = ref(false)
const currentPlaceName = ref<string | null>(null)

// --- dane
type Leaflet = { id: string; title: string; pages: string[] }
const leaflets = ref<Leaflet[]>([])

// aktywna gazetka
const activeLeafletId = ref<string | null>(null)
const pageIndex = ref(0)

const activeLeaflet = computed(() =>
  leaflets.value.find(l => l.id === activeLeafletId.value) || null
)

// MARKER CLICK -> pobierz gazetki i pokaż panel
async function onMarkerClick(place: { id: string; name?: string }) {
  panelOpen.value = true
  activeLeafletId.value = null
  pageIndex.value = 0
  currentPlaceName.value = place.name ?? 'Sklep'
  loading.value = true

  try {
    // TODO: podmień to na realne API/funkcję:
    // const data = await fetchLeafletsForPlace(place.id)
    const data = await mockFetchLeaflets(place.id)
    leaflets.value = data
  } catch (e) {
    console.error(e)
    leaflets.value = []
  } finally {
    loading.value = false
  }
}

function openLeaflet(id: string) {
  activeLeafletId.value = id
  pageIndex.value = 0
}

function closeLeaflet() {
  activeLeafletId.value = null
  pageIndex.value = 0
}

function closePanel() {
  panelOpen.value = false
  activeLeafletId.value = null
  pageIndex.value = 0
  leaflets.value = []
  currentPlaceName.value = null
}

// nawigacja stronami
function nextPage() {
  if (!activeLeaflet.value) return
  if (pageIndex.value < activeLeaflet.value.pages.length - 1) {
    pageIndex.value++
  }
}

function prevPage() {
  if (pageIndex.value > 0) pageIndex.value--
}

function goToPage(i: number) {
  pageIndex.value = i
}

// --- MOCK: usuń i zastąp swoim fetcherem
async function mockFetchLeaflets(placeId: string): Promise<Leaflet[]> {
  // symulacja ładownia
  await new Promise(r => setTimeout(r, 400))
  return [
    {
      id: `${placeId}-lidl`,
      title: 'Lidl — oferta tygodnia',
      pages: [
        'https://picsum.photos/seed/lidl1/700/990',
        'https://picsum.photos/seed/lidl2/700/990',
        'https://picsum.photos/seed/lidl3/700/990'
      ]
    },
    {
      id: `${placeId}-biedronka`,
      title: 'Biedronka — świeże',
      pages: [
        'https://picsum.photos/seed/bied1/700/990',
        'https://picsum.photos/seed/bied2/700/990'
      ]
    }
  ]
}
</script>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: 1fr 420px;
  height: 100vh;
  overflow: hidden;
}
.map-area { position: relative; overflow: hidden; }
.side-panel {
  border-left: 1px solid #e5e7eb;
  background: #fff;
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform .25s ease;
}
.side-panel.open { transform: translateX(0); }
.side-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid #f1f5f9;
}
.icon-btn {
  border: 1px solid #e5e7eb; background: #fff; border-radius: 10px;
  padding: 6px 10px; cursor: pointer;
}
.icon-btn:disabled { opacity: .5; cursor: not-allowed; }
.side-content { padding: 12px; overflow: auto; }
.state { color: #64748b; padding: 12px; }

.thumb-list {
  display: grid; grid-template-columns: 1fr; gap: 12px;
}
.thumb-card {
  display: grid; grid-template-columns: 96px 1fr; gap: 10px;
  border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease;
}
.thumb-card:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,0,0,.06); }
.thumb-card img {
  width: 96px; height: 136px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;
}
.thumb-meta { display: grid; align-content: center; gap: 6px; }
.thumb-title { font-weight: 600; }
.thumb-pages { color: #64748b; font-size: 12px; }

.viewer { display: flex; flex-direction: column; height: 100%; }
.back-btn {
  align-self: flex-start; margin: 10px 12px 0;
  background: transparent; border: none; color: #0ea5e9; cursor: pointer;
}
.viewer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px 10px; border-bottom: 1px solid #f1f5f9;
}
.viewer-title { font-weight: 600; }
.muted { color: #94a3b8; font-weight: 500; }
.page-wrap {
  flex: 1; display: grid; place-items: center; overflow: auto; padding: 10px;
  background: #f8fafc;
}
.page-wrap img {
  width: 100%; max-width: 360px; height: auto; border-radius: 12px;
  border: 1px solid #e5e7eb; background: #fff;
  box-shadow: 0 6px 28px rgba(15,23,42,.08);
}
.page-strip {
  display: flex; gap: 6px; padding: 10px; overflow-x: auto; border-top: 1px solid #f1f5f9;
  background: #fff;
}
.strip-thumb {
  border: 2px solid transparent; border-radius: 8px; padding: 0;
  background: none; cursor: pointer;
}
.strip-thumb.active { border-color: #0ea5e9; }
.strip-thumb img {
  width: 48px; height: 68px; object-fit: cover; border-radius: 6px; display: block;
}
@media (max-width: 1040px) {
  .app-shell { grid-template-columns: 1fr 360px; }
}
</style>
