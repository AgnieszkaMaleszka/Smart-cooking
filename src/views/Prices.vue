<template>
  <div
    class="prices-shell"
    :class="{ 'panel-open': !!selectedShop, 'list-open': isShoppingListOpen }"
  >
    <section class="left-panel">
      <MapPanel @shop-selected="onShopSelected" />
    </section>

    <!-- Panel zawsze w DOM (płynne otwieranie/zamykanie szerokością) -->
    <aside
      class="right-panel"
      role="complementary"
      :aria-hidden="(!selectedShop).toString()"
    >
      <header v-if="selectedShop" class="right-header">
        <div class="right-title">
          <h2 class="shop-title">{{ selectedShop?.shopName }}</h2>
          <p class="shop-subtitle">Gazetki i promocje</p>
        </div>

        <button
          class="right-close"
          @click="clearSelection"
          aria-label="Zamknij panel (Esc)"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>
      </header>

      <div v-if="selectedShop" class="right-body">
        <div v-if="loading" class="skeleton-grid" aria-live="polite">
          <div v-for="i in 4" :key="i" class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-tag"></div>
          </div>
        </div>

        <div v-else-if="error" class="state-feedback error" role="status">
          <div class="state-title">Wystąpił błąd</div>
          <p>{{ error }}</p>
        </div>

        <div v-else-if="!selectedShopFlyers.length" class="state-feedback" role="status">
          <div class="state-title">Brak gazetek</div>
          <p>Nie znaleźliśmy aktywnych promocji dla tego sklepu.</p>
        </div>

        <Flyers
          v-else
          :key="selectedShop.shopName"
          :shop="selectedShop"
          :flyers="selectedShopFlyers"
          @list-open-change="isShoppingListOpen = $event"
        />
      </div>
    </aside>
  </div>
</template>

<script>
import MapPanel from '../components/MapPanel.vue'
import Flyers from '../components/Flyers.vue'

const DEFAULT_API = 'http://localhost:8080'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minut

export default {
  name: 'Prices',
  components: { MapPanel, Flyers },
  data() {
    return {
      selectedShop: null,
      selectedShopFlyers: [],
      loading: false,
      error: null,
      isShoppingListOpen: false,
      _abortCtrl: null,
      flyersCache: new Map(),
      _escHandler: null
    }
  },
  methods: {
    clearSelection() {
      this.selectedShop = null
      this.error = null
      this.isShoppingListOpen = false
    },
    _fromCache(key) {
      const hit = this.flyersCache.get(key)
      if (!hit) return null
      if (Date.now() - hit.at > CACHE_TTL_MS) {
        this.flyersCache.delete(key)
        return null
      }
      return hit.data
    },
    _saveCache(key, data) { this.flyersCache.set(key, { at: Date.now(), data }) },
    _cleanupPending() {
      if (this._abortCtrl) {
        this._abortCtrl.abort()
        this._abortCtrl = null
      }
    },
    _normalizeFlyers(raw) {
      const arr = Array.isArray(raw) ? raw : []
      return arr
        .map((it, idx) => {
          const leafletLink = it.leafletLink || it.link || ''
          const id = leafletLink ? (leafletLink.split('/').filter(Boolean).pop() || `f-${idx}`) : `f-${idx}`
          const pagesRaw = it.leafletsURL || it.leafletsUrl || it.pages || []
          const pages = Array.isArray(pagesRaw) ? pagesRaw.filter(Boolean) : []
          const isBadImage = (u) => !u || u.startsWith('/') || /placeholder/i.test(u)
          let cover = pages.length ? pages[0] : ''
          if (!cover) {
            const imgCandidate = it.image || it.imageUrl || ''
            cover = !isBadImage(imgCandidate) ? imgCandidate : ''
          }
          return {
            id,
            title: it.title || it.shopName || 'Gazetka promocyjna',
            cover,
            pages: pages.length ? pages : (cover ? [cover] : []),
            validUntil: it.validUntil ?? null,
            leafletLink: leafletLink || null
          }
        })
        .filter(f => (f.cover && /^https?:\/\//i.test(f.cover)) || (Array.isArray(f.pages) && f.pages.length))
    },
    async onShopSelected(shop) {
      if (this.selectedShop?.shopName === shop?.shopName) return
      this.selectedShop = shop || null
      this.selectedShopFlyers = []
      this.error = null
      this.isShoppingListOpen = false

      if (!shop?.shopName) {
        this.clearSelection()
        return
      }

      const cacheKey = shop.shopName.trim()
      const cached = this._fromCache(cacheKey)
      if (cached) {
        this.selectedShopFlyers = cached
        return
      }

      this._cleanupPending()
      this._abortCtrl = new AbortController()
      this.loading = true
      try {
        const base = (import.meta.env.VITE_API_BASE || DEFAULT_API).replace(/\/+$/, '')
        const url = `${base}/promotionsFirst?shopName=${encodeURIComponent(shop.shopName)}`
        const res = await fetch(url, { signal: this._abortCtrl.signal })
        if (!res.ok) {
          let msg = `Błąd serwera (HTTP ${res.status})`
          try { const j = await res.clone().json(); if (j?.message) msg = j.message } catch {}
          try { const t = await res.clone().text(); if (t) msg = t } catch {}
          throw new Error(msg)
        }
        const raw = await res.json()
        const normalized = this._normalizeFlyers(raw)
        this.selectedShopFlyers = normalized
        this._saveCache(cacheKey, normalized)
      } catch (err) {
        if (err.name === 'AbortError') return
        const msg = String(err.message || '').trim()
        this.error = msg || 'Nie udało się pobrać gazetek. Spróbuj ponownie później.'
      } finally {
        this.loading = false
        this._cleanupPending()
      }
    }
  },
  mounted() {
    // ESC – tylko domykanie panelu sklepu; lista zamyka się w komponencie Flyers
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.selectedShop) {
        this.clearSelection()
      }
    }
    window.addEventListener('keydown', this._escHandler)
  },
  beforeUnmount() {
    this._cleanupPending()
    window.removeEventListener('keydown', this._escHandler)
  }
}
</script>

<style scoped>
:root {
  --font-body: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-head: 'Playfair Display', serif;
  --color-ink: #2E2A27;
  --color-ink-faded: #6F6A67;
  --color-paper: #ffffff;
  --color-paper-green: #ECF4F0;
  --color-paper-green-faded: #F1F6F3;
  --border: #e6e0d8;
  --border-subtle: #d9d9d9;
  --color-accent: #2F7A57;
  --color-accent-dark: #2A6A4E;
  --color-accent-faded: rgba(47,122,87,.25);
  --color-danger: #B23B3B;
  --color-danger-faded: #F0D6D6;
  --shadow-soft: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-card: 0 4px 12px rgba(0,0,0,0.08);
  --radius-md: 8px;
  --radius-lg: 12px;
  --transition-1: 0.2s ease-in-out;
  --space-4: 24px;
  --space-6: 40px;
}

.prices-shell {
  display: grid;
  grid-template-columns: 1fr; /* Make left panel always take full width */
  height: 100vh;
  overflow: hidden;
  font-family: var(--font-body);
}

.prices-shell.panel-open.list-open {
  /* No grid changes here as right-panel is absolute */
}

/* Lewy panel delikatnie przygasza się, bez mocnych „bumpów” */
.left-panel {
  transition: opacity 220ms ease;
  grid-column: 1 / -1; /* Ensure left panel always spans full width */
}
.prices-shell.panel-open .left-panel { opacity: 0.95; }
.prices-shell.list-open .left-panel { opacity: 0.9; }

/* Prawy panel – wyłącznie animacja szerokości i lekkiego krycia */
.right-panel {
  position: absolute; top: 0; bottom: 0; right: 0;
  z-index: 10;
  display: grid; grid-template-rows: auto 1fr;
  background: var(--color-paper);
  border-left: 1px solid var(--border);
  box-shadow: -8px 0 20px rgba(0,0,0,0.25); /* More pronounced shadow for depth */
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  overflow: hidden;

  width: clamp(380px, 50vw, 900px); /* Define base width */
  transform: translateX(100%); /* Start off-screen */
  opacity: 0;
  pointer-events: none;
  transition: transform 240ms ease-out, opacity 160ms ease-in;
  will-change: transform;
}

/* Otwarty panel (normalny) */
.prices-shell.panel-open .right-panel {
  transform: translateX(0); /* Slide into view */
  opacity: 1;
  pointer-events: auto;
}

/* Gdy w Flyers otwarta jest lista zakupów – delikatnie szerszy panel */
.prices-shell.panel-open.list-open .right-panel {
  width: clamp(660px, 66vw, 100vw); /* Expanded width for list view */
}

/* Zawartość prawego panelu */
.right-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: var(--space-4); border-bottom: 1px solid var(--border); background: var(--color-paper);
}
.shop-title { font-family: var(--font-head); font-weight: 600; font-size: 1.8rem; color: var(--color-ink); margin: 0; line-height: 1.2; letter-spacing: .5px; }
.shop-subtitle { font-family: var(--font-body); margin: 6px 0 0; font-size: .95rem; color: var(--color-ink-faded); }

.right-close {
  appearance: none; background: var(--color-paper); border: 1px solid var(--border-subtle); color: var(--color-ink);
  padding: 8px; border-radius: 50%; cursor: pointer; transition: var(--transition-1); box-shadow: var(--shadow-soft);
}
.right-close:hover { background: var(--color-paper-green); transform: translateY(-1px); box-shadow: var(--shadow-card); }
.right-close:active { transform: translateY(0); box-shadow: var(--shadow-soft); }

.right-body { padding: var(--space-4); overflow-y: auto; min-height: 0; background: var(--color-paper); }

.state-feedback { padding: 40px 20px; text-align: center; color: var(--color-ink-faded); }
.state-feedback .state-title { font-family: var(--font-head); font-weight: 600; font-size: 1.2rem; color: var(--color-ink); margin-bottom: 8px; }
.state-feedback.error { color: var(--color-danger); }

.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-4); }
.skeleton-card { border-radius: var(--radius-md); background: var(--color-paper-green); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(10, 64, 12, 0.1); }
.skeleton-img { height: 240px; background: rgba(10, 64, 12, 0.05); }
.skeleton-text { height: 20px; width: 80%; margin: 16px; background: rgba(10, 64, 12, 0.08); border-radius: 4px; }
.skeleton-tag { height: 16px; width: 40%; margin: 0 16px 16px; background: rgba(10, 64, 12, 0.08); border-radius: 4px; }

/* Mobile: panel jako fullscreen, ale bez jazdy w bok (fade only) */
@media (max-width: 960px) {
  .prices-shell {
    grid-template-columns: 1fr auto;
  }
  .right-panel {
    position: fixed; inset: 0; border-left: none; border-radius: 0;
    width: 0; /* start */
    opacity: 0;
  }
  .prices-shell.panel-open .right-panel {
    width: 100%;
    opacity: 1;
  }
}

/* Preferencje dostępności — ograniczenie ruchu */
@media (prefers-reduced-motion: reduce) {
  .left-panel, .right-panel, .right-close {
    transition: none !important;
  }
}
</style>