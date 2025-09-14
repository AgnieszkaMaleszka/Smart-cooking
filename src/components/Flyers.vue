<template>
  <div class="flyers-container">
    <transition name="view-fade" mode="out-in">
      <!-- SIATKA OKŁADEK -->
      <div v-if="activeIndex === -1" key="grid" class="cover-grid" aria-label="Lista gazetek">
        <button
          v-for="(flyer, i) in flyers"
          :key="flyer.id || i"
          class="cover-card"
          @click="open(i)"
          :aria-label="`Otwórz gazetkę: ${flyer.title}`"
        >
          <div class="cover-image-wrapper">
            <img
              :src="flyer.cover || (flyer.pages && flyer.pages[0])"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              draggable="false"
            />
            <span class="status-badge" :class="statusFor(flyer).kind">
              {{ statusFor(flyer).label }}
            </span>
          </div>
          <div class="cover-info">
            <h3 class="cover-title">{{ flyer.title }}</h3>
          </div>
        </button>
      </div>

      <!-- PRZEGLĄDARKA GAZETKI -->
      <div v-else key="viewer" class="viewer" aria-label="Przeglądarka gazetki">
        <!-- Pasek górny -->
        <div class="viewer-header">
          <div class="viewer-left">
            <button class="btn ghost" @click="exitViewer" aria-label="Wróć do listy">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              Wszystkie gazetki
            </button>
            <div class="title-subtle" :title="current?.title">{{ current?.title }}</div>
          </div>

          <div class="viewer-right">
            <button
              class="btn ghost"
              :class="{ active: selectionMode }"
              @click="toggleSelectionMode"
              :aria-pressed="selectionMode.toString()"
              title="Zaznacz produkty (S)"
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path
                  d="M4 10c0-3.314 3.134-6 7-6s7 2.686 7 6-3.134 6-7 6c-1.186 0-2.304-.22-3.293-.614C7.01 15.14 6 16 5 17c0 0 2 1 4 1"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              Zaznacz
            </button>

            <button
              v-if="selectedId"
              class="btn subtle danger"
              @click="removeById(selectedId)"
              title="Usuń zaznaczenie (Delete)"
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path
                  d="M6 7h12M9 7v11m6-11v11M10 7l1-2h2l1 2"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
              Usuń
            </button>

            <button
              class="btn ghost"
              @click="listOpen = !listOpen"
              title="Lista zakupów (L)"
              :aria-expanded="listOpen.toString()"
            >
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M7 6h10M7 12h10M7 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              Lista
              <span v-if="totalSelectionsCurrentFlyer" class="counter">{{ totalSelectionsCurrentFlyer }}</span>
            </button>
          </div>
        </div>

        <!-- Layout: strona + panel listy (pushing) -->
        <div class="viewer-body" :class="{ 'list-visible': listOpen }">
          <div class="canvas-column">
            <!-- Strona + warstwa zaznaczeń -->
            <div class="page-wrapper">
              <!-- Edge nawigacja -->
              <button
                v-if="pages.length > 1 && !selectionMode"
                class="edge-nav left"
                :disabled="page === 0"
                @click="prev"
                aria-label="Poprzednia strona"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <button
                v-if="pages.length > 1 && !selectionMode"
                class="edge-nav right"
                :disabled="page >= pages.length - 1"
                @click="next"
                aria-label="Następna strona"
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <!-- .page-stage = faktyczne wymiary obrazu -->
              <div
                class="page-surface"
                :class="{ 'is-selecting': selectionMode }"
                tabindex="0"
                role="application"
                :aria-label="`Strona ${page + 1} z ${pages.length}`"
              >
                <div
                  class="page-stage"
                  ref="stage"
                  :class="{ 'is-selecting': selectionMode }"
                  @pointerdown="onSurfacePointerDown"
                  @pointermove="onSurfacePointerMove"
                  @pointerup="onSurfacePointerUp"
                  @pointercancel="onSurfacePointerCancel"
                  @pointerleave="onSurfacePointerLeave"
                >
                  <img
                    ref="pageImage"
                    :src="pages[page]"
                    :alt="`Strona ${page + 1} z ${pages.length}`"
                    referrerpolicy="no-referrer"
                    draggable="false"
                    @load="onPageImageLoad(page, $event)"
                  />

                  <!-- Zaznaczenia -->
                  <div class="selections-layer" aria-label="Zaznaczenia">
                    <div
                      v-for="sel in selectionsForCurrentPage"
                      :key="sel.id"
                      class="selection-box"
                      :class="{ highlight: sel.id === highlightId, selected: sel.id === selectedId }"
                      :style="styleFromRect(sel.rect)"
                      @pointerdown.stop="onSelectionPointerDown(sel, $event)"
                      @click.stop="selectedId = sel.id"
                      @dblclick.stop="listOpen = true; selectedId = sel.id"
                      :title="sel.title || 'Zaznaczenie'"
                    >
                      <span class="selection-label">{{ sel.title || 'Produkt' }}</span>
                      <button class="handle nw" aria-label="Rozmiar góra-lewo" @pointerdown.stop.prevent="onHandlePointerDown(sel, 'nw', $event)"></button>
                      <button class="handle ne" aria-label="Rozmiar góra-prawo" @pointerdown.stop.prevent="onHandlePointerDown(sel, 'ne', $event)"></button>
                      <button class="handle sw" aria-label="Rozmiar dół-lewo" @pointerdown.stop.prevent="onHandlePointerDown(sel, 'sw', $event)"></button>
                      <button class="handle se" aria-label="Rozmiar dół-prawo" @pointerdown.stop.prevent="onHandlePointerDown(sel, 'se', $event)"></button>
                    </div>

                    <div
                      v-if="action.kind === 'draw' && draftRect"
                      class="selection-box draft"
                      :style="styleFromRect(draftRect)"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Miniatury stron -->
            <div v-if="pages.length > 1" class="thumbs-wrapper" aria-label="Miniatury stron">
              <button
                v-for="(p, i) in pages"
                :key="i"
                class="thumb"
                :class="{ active: i === page }"
                @click="page = i"
                :aria-label="`Przejdź do strony ${i + 1}`"
              >
                <img :src="p" alt="" loading="lazy" referrerpolicy="no-referrer" draggable="false" />
              </button>
            </div>
          </div>

          <ShoppingListPanel
            v-if="listOpen"
            :open="true"
            :selections="currentSelections"
            :pages="pages"
            :shop="shop"
            :validity="validityLabel"
            :selectedId="selectedId"
            :pageMeta="pageMeta"
            @update:selectedId="id => (selectedId = id)"
            @hover="id => (highlightId = id)"
            @hover-end="() => (highlightId = null)"
            @goto="goToSelection"
            @remove="removeSelection"
            @change="persistSelections"
            @open-lightbox="openLightbox"
            @clear="clearCurrentList"  
          />
        </div>

        <!-- LIGHTBOX powiększenia wycinka -->
        <div v-if="lightbox.open" class="lightbox" role="dialog" aria-modal="true" @click.self="closeLightbox">
          <div class="lightbox-body">
            <button class="btn icon ghost close" @click="closeLightbox" aria-label="Zamknij">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
              </svg>
            </button>

            <div class="zoom-box" v-if="lightbox.sel">
              <div class="zoom-crop" :style="cropContainerStyle(lightbox.sel, true)">
                <img :src="pages[lightbox.sel.page]" :style="cropImageStyle(lightbox.sel)" alt="Powiększony podgląd" />
              </div>
              <div class="zoom-meta">
                <div class="zoom-title">{{ lightbox.sel.title || 'Produkt' }}</div>
                <div class="zoom-sub">
                  <span v-if="lightbox.sel.price">Cena: {{ lightbox.sel.price }}</span>
                  <span v-else class="muted">Brak ceny</span>
                  <span class="dot"></span>
                  <span>Strona {{ lightbox.sel.page + 1 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import ShoppingListPanel from './ShoppingListPanel.vue'

const DEFAULT_API = 'http://localhost:8080'

export default {
  name: 'Flyers',
  components: { ShoppingListPanel },
  emits: ['list-open-change'],
  props: {
    shop: { type: Object, default: null },
    flyers: { type: Array, default: () => [] }
  },
  data() {
    return {
      activeIndex: -1,
      page: 0,
      loadingIndex: -1,
      items: [],

      // Zaznaczanie / edycja
      selectionMode: false,
      action: { kind: null, dir: null, selId: null, startRect: null, startPt: null, pointerId: null },
      draftRect: null,
      selectedId: null,
      highlightId: null,

      // Lista zakupów (pushing)
      listOpen: false,

      // Persist
      selectionsMap: {},

      // Lightbox
      lightbox: { open: false, sel: null },

      // Meta stron (AR do precyzyjnego cropu)
      pageMeta: {} // { [pageIndex]: { w, h, ar } }
    }
  },
  watch: {
    flyers: {
      immediate: true,
      handler(val) {
        this.items = Array.isArray(val) ? val.map(v => ({ ...v })) : []
      }
    },
    activeIndex() {
      this.page = 0
      this.selectionMode = false
      this.resetAction()
      this.draftRect = null
      this.selectedId = null
      this.highlightId = null
      this.listOpen = false
      this.pageMeta = {}
      this.loadSelections()
      this.$nextTick(() => this.preloadPageMeta())
    },
    pages: {
      immediate: true,
      handler() {
        // gdy zmieniają się strony (np. po pobraniu), preload meta
        this.pageMeta = {}
        this.$nextTick(() => this.preloadPageMeta())
      }
    },
    listOpen(val) {
      this.$emit('list-open-change', !!val)
    }
  },
  computed: {
    current() {
      return this.items[this.activeIndex] || null
    },
    pages() {
      if (!this.current) return []
      return Array.isArray(this.current.pages) && this.current.pages.length
        ? this.current.pages
        : (this.current.cover ? [this.current.cover] : [])
    },
    flyerKey() {
      if (!this.current) return null
      return this._extractLeafletId(this.current) || (this.current.id || 'flyer')
    },
    currentSelections() {
      const all = this.selectionsMap[this.flyerKey] || []
      for (const s of all) if (typeof s.done === 'undefined') s.done = false
      return all.slice().sort((a, b) => b.at - a.at)
    },
    selectionsForCurrentPage() {
      return this.currentSelections.filter(s => s.page === this.page)
    },
    totalSelectionsCurrentFlyer() {
      return (this.selectionsMap[this.flyerKey] || []).length
    },
    validityLabel() {
      const raw = (this.current?.validUntil || '').toString().trim().toLowerCase()
      if (!raw) return 'Aktualna'
      if (raw.includes('archiwalna')) return 'Archiwalna'
      if (raw.includes('aktualna')) return 'Aktualna'
      if (raw.includes('dziś') || raw.includes('dzisiaj')) return 'Do dziś'
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = new Date(raw)
        if (!isNaN(d)) return `Do ${this.formatDate(d)}`
      }
      return raw.replace(/^\s*do\s*/i, 'Do ').replace(/(^.)/, s => s.toUpperCase())
    }
  },
  methods: {
    // Pobieranie/otwieranie
    _extractLeafletId(flyer) {
      const raw = (flyer?.id ?? '').toString().trim()
      if (/^\d+$/.test(raw)) return raw
      const fromLink = (flyer?.leafletLink || '').toString()
      const m = fromLink.match(/\/(\d{3,})\/?$/)
      return m ? m[1] : null
    },
    _dedupeAndPickLargestBucket(urls) {
      if (!Array.isArray(urls)) return []
      const parse = (u) => {
        try {
          const url = new URL(u)
          return { u, key: url.origin + url.pathname, bucket: Number(url.searchParams.get('bucket')) || 0 }
        } catch {
          return { u, key: u.replace(/[\?&]bucket=\d+/i, ''), bucket: 0 }
        }
      }
      const best = new Map()
      for (const u of urls) {
        if (!u) continue
        const p = parse(u), prev = best.get(p.key)
        if (!prev || p.bucket > prev.bucket) best.set(p.key, p)
      }
      const seen = new Set(), ordered = []
      for (const u of urls) {
        const p = parse(u)
        if (seen.has(p.key)) continue
        const chosen = best.get(p.key)
        if (chosen) { ordered.push(chosen.u); seen.add(p.key) }
      }
      return ordered
    },
  async open(i) {
    const flyer = this.items[i]
    if (!flyer) return

    // ⬇⬇ ZAWSZE spróbuj wyliczyć leafletId na starcie
    const leafletId = this._extractLeafletId(flyer)
    // jeśli już mamy strony -> zapisz do LS meta + strony i otwórz viewer
    if (Array.isArray(flyer.pages) && flyer.pages.length > 1) {
      if (leafletId) this.saveFlyerToLS(leafletId, flyer.pages, flyer)   // ⬅⬅ DODANE
      this.activeIndex = i
      this.page = 0
      return
    }

    if (!leafletId) {
      alert('Nie udało się rozpoznać identyfikatora gazetki.')
      return
    }

    this.loadingIndex = i
    try {
      const base = (import.meta.env.VITE_API_BASE || DEFAULT_API).replace(/\/+$/, '')
      const endpoint = `${base}/leaflet/${encodeURIComponent(leafletId)}/pages`
      const res = await fetch(endpoint)
      if (!res.ok) {
        let msg = `Błąd pobierania stron (HTTP ${res.status})`
        try { const j = await res.clone().json(); if (j?.message) msg = j.message } catch {}
        try { const t = await res.clone().text(); if (t) msg = t } catch {}
        throw new Error(msg)
      }
      const pagesRaw = await res.json()
      const pages = this._dedupeAndPickLargestBucket(pagesRaw)
      if (!Array.isArray(pages) || pages.length === 0) throw new Error('Brak stron do wyświetlenia dla tej gazetki.')

      // ⬇⬇ ZAPISZ meta + strony do LS zanim pokażesz viewer
      this.saveFlyerToLS(leafletId, pages, flyer)                          // ⬅⬅ DODANE

      this.items[i] = { ...flyer, pages }
      this.activeIndex = i
      this.page = 0
      console.log('Fetched pages:', pages)
    } catch (e) {
      console.error('Błąd przy pobieraniu stron:', e)
      alert(typeof e?.message === 'string' ? e.message : 'Nie udało się pobrać stron tej gazetki.')
    } finally {
      this.loadingIndex = -1
    }
},

    next() { if (this.page < this.pages.length - 1) this.page++ },
    prev() { if (this.page > 0) this.page-- },
    statusFor(f) {
      const raw = (f?.validUntil || '').toString().trim().toLowerCase()
      if (raw === 'aktualna') return { label: 'Aktualna', kind: 'active' }
      if (raw === 'archiwalna') return { label: 'Archiwalna', kind: 'expired' }
      return { label: raw || 'Aktualna', kind: 'active' }
    },

    // UX / klawiatura
    exitViewer() {
      this.activeIndex = -1
      this.selectionMode = false
      this.listOpen = false
      this.selectedId = null
    },
    onKeyDown(e) {
      if (this.lightbox.open && e.key === 'Escape') { this.closeLightbox(); return }
      if (this.activeIndex === -1) return
      const k = e.key.toLowerCase()
      if (k === 'arrowleft') { e.preventDefault(); this.prev() }
      if (k === 'arrowright') { e.preventDefault(); this.next() }
      if (k === 's') { this.toggleSelectionMode() }
      if (k === 'l') { this.listOpen = !this.listOpen }
      if (k === 'escape') {
        if (this.action.kind) this.cancelAction()
        else if (this.selectionMode) this.selectionMode = false
        else if (this.listOpen) this.listOpen = false
        else this.exitViewer()
      }
      if ((k === 'delete' || k === 'backspace') && this.selectedId) this.removeById(this.selectedId)
    },

    // Zaznaczanie i edycja
    toggleSelectionMode() {
      this.selectionMode = !this.selectionMode
      if (!this.selectionMode) this.cancelAction()
    },
    resetAction() {
      this.action = { kind: null, dir: null, selId: null, startRect: null, startPt: null, pointerId: null }
      this.draftRect = null
    },
    normPt(clientX, clientY) {
      const el = this.$refs.stage
      if (!el) return { x: 0, y: 0 }
      const r = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height))
      return { x, y } // 0..1 względem obrazu
    },
    onSurfacePointerDown(e) {
      if (!this.selectionMode) return
      if (e.button !== 0 && e.pointerType !== 'touch') return
      if (e.target && e.target.classList && (e.target.classList.contains('selection-box') || e.target.classList.contains('handle'))) return

      const p = this.normPt(e.clientX, e.clientY)
      this.action = {
        kind: 'draw',
        dir: null,
        selId: null,
        startRect: { x: p.x * 100, y: p.y * 100, w: 0, h: 0 },
        startPt: { x: p.x, y: p.y },
        pointerId: e.pointerId
      }
      this.draftRect = { ...this.action.startRect }
      this.$refs.stage.setPointerCapture(e.pointerId)
    },
    onSurfacePointerMove(e) {
      if (!this.action.kind || e.pointerId !== this.action.pointerId) return
      const p = this.normPt(e.clientX, e.clientY)
      const dx = (p.x - this.action.startPt.x) * 100
      const dy = (p.y - this.action.startPt.y) * 100

      if (this.action.kind === 'draw') {
        const x1 = Math.min(this.action.startRect.x, this.action.startRect.x + dx)
        const y1 = Math.min(this.action.startRect.y, this.action.startRect.y + dy)
        const x2 = Math.max(this.action.startRect.x, this.action.startRect.x + dx)
        const y2 = Math.max(this.action.startRect.y, this.action.startRect.y + dy)
        this.draftRect = this.clampRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
      }

      if (this.action.kind === 'move' || this.action.kind === 'resize') {
        const list = this.selectionsMap[this.flyerKey] || []
        const sel = list.find(s => s.id === this.action.selId)
        if (!sel) return

        if (this.action.kind === 'move') {
          const nx = this.action.startRect.x + dx
          const ny = this.action.startRect.y + dy
          sel.rect = this.clampRect({ x: nx, y: ny, w: sel.rect.w, h: sel.rect.h })
          this.bumpSelectionsMap()
        } else {
          sel.rect = this.applyResize(this.action.startRect, dx, dy, this.action.dir)
          this.bumpSelectionsMap()
        }
      }
    },
    onSurfacePointerUp(e) {
      if (!this.action.kind || e.pointerId !== this.action.pointerId) return
      if (this.action.kind === 'draw') {
        const area = (this.draftRect?.w || 0) * (this.draftRect?.h || 0)
        if (this.draftRect && area >= 0.5) {
          const sel = {
            id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            page: this.page,
            rect: { ...this.draftRect },
            title: '',
            price: '',
            done: false,
            at: Date.now()
          }
          const key = this.flyerKey
          const arr = (this.selectionsMap[key] || []).concat(sel)
          this.setSelectionsForKey(key, arr)
          this.persistSelections()
          this.selectedId = sel.id
          this.listOpen = true
        }
        this.draftRect = null
      } else {
        this.persistSelections()
      }

      try { this.$refs.stage.releasePointerCapture(this.action.pointerId) } catch {}
      this.resetAction()
    },
    onSurfacePointerCancel() { this.cancelAction() },
    onSurfacePointerLeave() { /* pointer capture i tak trzyma eventy */ },
    cancelAction() {
      if (this.action.pointerId && this.$refs.stage) {
        try { this.$refs.stage.releasePointerCapture(this.action.pointerId) } catch {}
      }
      this.resetAction()
    },
    onSelectionPointerDown(sel, e) {
      if (!this.selectionMode) return
      const p = this.normPt(e.clientX, e.clientY)
      this.action = {
        kind: 'move',
        dir: null,
        selId: sel.id,
        startRect: { ...sel.rect },
        startPt: { x: p.x, y: p.y },
        pointerId: e.pointerId
      }
      this.selectedId = sel.id
      this.$refs.stage.setPointerCapture(e.pointerId)
    },
    onHandlePointerDown(sel, dir, e) {
      if (!this.selectionMode) return
      const p = this.normPt(e.clientX, e.clientY)
      this.action = {
        kind: 'resize',
        dir,
        selId: sel.id,
        startRect: { ...sel.rect },
        startPt: { x: p.x, y: p.y },
        pointerId: e.pointerId
      }
      this.selectedId = sel.id
      this.$refs.stage.setPointerCapture(e.pointerId)
    },
    clampRect(rect) {
      const minW = 2, minH = 2
      let { x, y, w, h } = rect
      w = Math.max(minW, w); h = Math.max(minH, h)
      x = Math.min(100 - w, Math.max(0, x))
      y = Math.min(100 - h, Math.max(0, y))
      return { x, y, w, h }
    },
    applyResize(start, dx, dy, dir) {
      let x = start.x, y = start.y, w = start.w, h = start.h
      if (dir.includes('n')) { y = y + dy; h = h - dy }
      if (dir.includes('s')) { h = h + dy }
      if (dir.includes('w')) { x = x + dx; w = w - dx }
      if (dir.includes('e')) { w = w + dx }
      return this.clampRect({ x, y, w, h })
    },
    styleFromRect(r) {
      return {
        left: r.x + '%',
        top: r.y + '%',
        width: r.w + '%',
        height: r.h + '%'
      }
    },

    // Persist
    removeSelection(sel) {
      const key = this.flyerKey
      const arr = (this.selectionsMap[key] || []).filter(s => s.id !== sel.id)
      this.setSelectionsForKey(key, arr)
      this.persistSelections()
      if (this.selectedId === sel.id) this.selectedId = null
    },
    removeById(id) {
      const sel = (this.selectionsMap[this.flyerKey] || []).find(s => s.id === id)
      if (sel) this.removeSelection(sel)
    },
    focusSelection(sel) {
      this.page = sel.page
      this.highlightId = sel.id
      this.$nextTick(() => setTimeout(() => { this.highlightId = null }, 1200))
    },
    goToSelection(sel) { this.focusSelection(sel) },

    storageKey() {
      return this.flyerKey ? `flyerSelections:${this.flyerKey}` : null
    },
    loadSelections() {
      const key = this.storageKey()
      if (!key) return
      try {
        const raw = localStorage.getItem(key)
        const arr = raw ? JSON.parse(raw) : []
        this.setSelectionsForKey(this.flyerKey, Array.isArray(arr) ? arr : [])
      } catch {
        this.setSelectionsForKey(this.flyerKey, [])
      }
    },
    persistSelections() {
      const key = this.storageKey()
      if (!key) return
      const arr = this.selectionsMap[this.flyerKey] || []
      try { localStorage.setItem(key, JSON.stringify(arr)) } catch {}
    },
    setSelectionsForKey(key, arr) {
      this.selectionsMap = { ...this.selectionsMap, [key]: arr }
    },
    bumpSelectionsMap() {
      this.selectionsMap = { ...this.selectionsMap }
    },

    // Meta obrazów (AR) – precyzyjny crop 1:1
    preloadPageMeta() {
      if (!Array.isArray(this.pages)) return
      this.pages.forEach((_, i) => this.ensureMetaFor(i))
    },
    ensureMetaFor(i) {
      if (this.pageMeta[i]?.ar) return
      const src = this.pages[i]
      if (!src) return
      const img = new Image()
      img.referrerPolicy = 'no-referrer'
      // img.crossOrigin = 'anonymous' // naturalWidth/Height nie wymaga CORS
      img.onload = () => {
        const w = img.naturalWidth || 1
        const h = img.naturalHeight || 1
        const ar = w / h
        this.pageMeta = { ...this.pageMeta, [i]: { w, h, ar } }
      }
      img.onerror = () => {
        this.pageMeta = { ...this.pageMeta, [i]: { w: 1, h: 1, ar: 1 } }
      }
      img.src = src
    },
   onPageImageLoad(pageIndex, e) {
    const img = e?.target
    const w = img?.naturalWidth || 1
    const h = img?.naturalHeight || 1
    const ar = w / h
    this.pageMeta = { ...this.pageMeta, [pageIndex]: { w, h, ar } }
  },

    // Podgląd wycinków (crop) – z uwzględnieniem AR strony
    cropContainerStyle(sel, large = false) {
      const r = sel.rect || { w: 50, h: 50 }
      const pageAR = this.pageMeta?.[sel.page]?.ar || 1
      const ratio = (r.w > 0 && r.h > 0) ? (r.w / r.h) * pageAR : 1
      return {
        position: 'relative',
        aspectRatio: String(ratio),
        width: large ? 'min(80vw, 720px)' : '120px',
        overflow: 'hidden',
        borderRadius: large ? '12px' : '10px'
      }
    },
    cropImageStyle(sel) {
    const r = sel.rect || { x: 0, y: 0, w: 50, h: 50 }
    const widthPercent = r.w ? (10000 / r.w) : 10000
    return {
      position: 'absolute',
      top: '0',
      left: '0',
      width: widthPercent + '%',
      maxWidth: 'none', // <- gwarantuje brak ograniczenia z globalnych styli
      height: 'auto',
      transformOrigin: 'top left',
      transform: `translate(${-r.x}%, ${-r.y}%)`,
      willChange: 'transform'
    }
  },

    // Lightbox
    openLightbox(sel) { this.lightbox = { open: true, sel } },
    closeLightbox() { this.lightbox = { open: false, sel: null } },

    // Formatowanie / liczby
    formatDate(tsOrDate) {
      const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate)
      if (isNaN(d)) return '—'
      return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
    },
    parsePrice(txt) {
      if (!txt) return null
      const s = String(txt).replace(/\s+/g, '').replace(/[zł€$]/gi, '').replace(',', '.')
      const m = s.match(/-?\d+(\.\d+)?/)
      if (!m) return null
      return parseFloat(m[0])
    },
    formatCurrency(v) {
      try {
        return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v)
      } catch {
        return `${v.toFixed(2)} zł`
      }
    },
    // Zapis stron i metadanych gazetki do localStorage
    saveFlyerToLS(leafletId, pages, flyer) {
      if (!leafletId || !Array.isArray(pages) || !pages.length) return
      try {
        const meta = {
          storeName: this.shop?.shopName || this.shop?.name || flyer?.brand || flyer?.title || 'Gazetka',
          logoUrl:   this.shop?.logo || this.shop?.logoUrl || this.shop?.image || '',
          title:     flyer?.title || ''
          // możesz dodać np. validUntil itp.
        }
        localStorage.setItem(`flyerPages:${leafletId}`, JSON.stringify(pages))
        localStorage.setItem(`flyerMeta:${leafletId}`,  JSON.stringify(meta))
      } catch { /* ignore */ }
    }, 
    clearCurrentList() {
      const key = this.flyerKey
      if (!key) return
      this.setSelectionsForKey(key, [])
      this.persistSelections()
      this.selectedId = null
    }
  },
  mounted() {
    window.addEventListener('keydown', this.onKeyDown)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeyDown)
  }
}
</script>

<style scoped>
/* Ogólne */
.flyers-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family: var(--font-body);
}

/* Siatka okładek */
.cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
  overflow-y: auto;
  padding-right: var(--space-1);
}
.cover-card {
  background: var(--color-paper);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: visible;
  cursor: pointer;
  transition: transform var(--transition-1), box-shadow var(--transition-1);
  box-shadow: var(--shadow-soft);
  height: auto;
}
.cover-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
.cover-card:active { transform: translateY(0); box-shadow: var(--shadow-soft); }
.cover-image-wrapper { position: relative; background: var(--color-paper-green-faded); border-bottom: 1px solid var(--border); }
.cover-image-wrapper img { width: 100%; height: 100%; display: block; object-fit: contain; }
.status-badge {
  position: absolute; top: var(--space-3); left: var(--space-3);
  background: var(--color-paper-green); color: var(--color-ink);
  padding: 4px 8px; border-radius: var(--radius-md); font-size: 12px; font-weight: 600;
  border: 1px solid rgba(10, 64, 12, 0.1);
}
.status-badge.expired { background: var(--color-paper); color: var(--color-ink-faded); border-color: var(--border-subtle); }
.cover-info { padding: var(--space-3); }
.cover-title {
  margin: 0; color: var(--color-ink); font-weight: 600; font-family: var(--font-head);
  line-height: 1.25; font-size: 1.1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  display: none;
}

/* Viewer */
.viewer {
  display: flex; flex-direction: column; gap: var(--space-3);
  min-height: 0; height: 100%;
}
.viewer-header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.viewer-left, .viewer-right { display: flex; align-items: center; gap: var(--space-2); }
.title-subtle { color: var(--color-ink-faded); font-size: .95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.viewer-body {
  display: grid;
  grid-template-columns: 1fr; /* pushing: domyślnie 1 kolumna */
  gap: var(--space-4);
  min-height: 0; height: 100%;
}
.viewer-body.list-visible {
  grid-template-columns: 1fr minmax(320px, 1fr); /* Adjusted list column width to be less wide */
}
.canvas-column {
  display: flex; flex-direction: column; gap: var(--space-3);
  min-width: 0; min-height: 0; height: 100%;
}

/* Przyciski */
.btn {
  appearance: none; border: 1px solid var(--border-subtle); background: var(--color-paper);
  color: var(--color-ink); border-radius: var(--radius-md); padding: 8px 12px; font-weight: 500;
  cursor: pointer; transition: var(--transition-1); line-height: 1; display: inline-flex; align-items: center; gap: 8px; box-shadow: var(--shadow-soft);
}
.btn svg { width: 18px; height: 18px; }
.btn:hover { background: var(--color-paper-green); box-shadow: var(--shadow-card); transform: translateY(-1px); }
.btn:active { transform: translateY(0); box-shadow: var(--shadow-soft); }
.btn:disabled { color: var(--color-ink-faded); cursor: not-allowed; opacity: 0.6; }
.btn.icon { width: 36px; height: 36px; padding: 0; justify-content: center; border-radius: 50%; }
.btn.ghost { border-color: transparent; background: transparent; box-shadow: none; color: var(--color-ink); }
.btn.ghost:hover { background: var(--color-paper-green-faded); transform: none; box-shadow: none; }
.btn.ghost.active { background: var(--color-paper-green); border-color: var(--color-accent-faded); }
.btn.subtle { background: var(--color-paper-green-faded); border-color: transparent; color: var(--color-ink); box-shadow: none; }
.btn.subtle:hover { background: var(--color-paper-green); }
.btn.subtle.danger { color: var(--color-danger); background: var(--color-danger-faded); }
.btn.subtle.danger:hover { background: var(--color-danger); color: var(--color-paper); }
.btn.tiny { padding: 6px 10px; border-radius: var(--radius-md); font-weight: 500; font-size: .8rem; }
.btn.link { border: none; background: transparent; color: var(--color-accent); padding: 6px 8px; box-shadow: none; transform: none; }
.btn.link:hover { text-decoration: underline; color: var(--color-accent-dark); }

/* Strona + zaznaczenia */
.page-wrapper {
  position: relative; background: var(--color-paper); border-radius: var(--radius-lg); overflow: hidden;
  border: 1px solid var(--border); box-shadow: var(--shadow-card); flex-grow: 1; display: grid; place-items: center;
}
/* Kontener strony */
.page-surface {
  position: relative; width: 100%; max-width: 100%; max-height: 100%; display: grid; place-items: center;
}
/* .page-stage = rozmiar obrazu */
.page-stage {
  position: relative; display: inline-block; max-width: 100%; max-height: 70vh;
}
.page-stage.is-selecting { touch-action: none; }
.page-stage img {
  display: block; width: auto; height: auto; max-width: 100%; max-height: 70vh; object-fit: contain; user-select: none; pointer-events: none;
}
/* Overlay względem .page-stage */
.selections-layer { position: absolute; inset: 0; pointer-events: none; }
.selection-box {
  position: absolute; border: 2px solid var(--color-accent); background: rgba(47, 122, 87, 0.1);
  border-radius: var(--radius-md); pointer-events: auto; transition: box-shadow var(--transition-1), border-color var(--transition-1);
}
.selection-box:hover { box-shadow: 0 0 0 3px var(--color-accent-faded) inset; }
.selection-box.selected { border-color: var(--color-accent-dark); background: rgba(47, 122, 87, 0.15); }
.selection-box.draft { border-style: dashed; }
.selection-label {
  position: absolute; bottom: 4px; left: 4px; padding: 2px 6px; border-radius: var(--radius-sm);
  font-size: 11px; color: var(--color-paper); background: var(--color-ink-dark);
}

/* Uchwyty */
.handle { position: absolute; width: 12px; height: 12px; background: var(--color-paper); border: 1.5px solid var(--color-accent); border-radius: 50%; box-shadow: var(--shadow-soft); cursor: pointer; z-index: 10; }
.handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }
.handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }
.handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }
.handle.se { bottom: -6px; right: -6px; cursor: nwse-resize; }

/* Miniatury */
.thumbs-wrapper { display: flex; gap: var(--space-2); overflow-x: auto; padding: 4px; scrollbar-width: thin; }
.thumb {
  flex-shrink: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--color-paper);
  cursor: pointer; transition: border-color var(--transition-1), transform var(--transition-1); overflow: hidden; box-shadow: var(--shadow-soft);
}
.thumb:hover { border-color: var(--color-accent-faded); }
.thumb.active { border-color: var(--color-accent-dark); transform: translateY(-1px); }
.thumb img { width: 54px; height: 74px; object-fit: contain; display: block; background: var(--color-paper-green-faded); }

/* Edge nav */
.edge-nav {
  position: absolute; top: 0; bottom: 0; width: clamp(70px, 20vw, 280px); /* Increased width to spread them out more */
  display: grid; place-items: center; background: linear-gradient(to right, rgba(10, 64, 12, 0.1), transparent);
  border: none; color: var(--color-ink); cursor: pointer; opacity: 1; transition: opacity var(--transition-1), background var(--transition-1);
  pointer-events: auto;
  z-index: 20;
}
.edge-nav svg { width: 20px; height: 20px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.15)); }
.edge-nav.right:hover svg { filter: drop-shadow(0 0 8px var(--color-accent)) drop-shadow(0 0 16px var(--color-accent)); /* Apply glow to SVG on hover */ }
.page-wrapper:hover .edge-nav { opacity: 1; }
.edge-nav.left:hover { background: linear-gradient(to right, rgba(10, 64, 12, 0.25), transparent); }
.edge-nav:disabled { opacity: 0; cursor: default; }
/* Spacing for arrows */
.edge-nav.left { left: 0; border-radius: var(--radius-lg) 0 0 var(--radius-lg); }
.edge-nav.right {
  right: 0; border-radius: 0 var(--radius-lg) var(--radius-lg) 0; transform: rotate(0deg);
  background: linear-gradient(to left, rgba(10, 64, 12, 0.1), transparent);
}
.edge-nav.right:hover {
  background: linear-gradient(to left, rgba(10, 64, 12, 0.25), transparent) !important; /* Force glow on hover */
  box-shadow: 0 0 10px rgba(10, 64, 12, 0.5); /* Add a glow effect */
  filter: brightness(1.2); /* Enhance glow effect */
}

/* Lightbox */
.lightbox {
  position: fixed; inset: 0; background: rgba(10, 64, 12, 0.1); backdrop-filter: blur(4px);
  display: grid; place-items: center; z-index: 9999; padding: var(--space-4);
}
.lightbox-body {
  position: relative; background: var(--color-paper); border-radius: var(--radius-lg); border: 1px solid var(--border);
  padding: var(--space-4); max-width: 90vw; box-shadow: var(--shadow-card);
}
.lightbox .close { position: absolute; top: 8px; right: 8px; }
.zoom-box { display: grid; gap: var(--space-3); }
.zoom-crop { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; position: relative; box-shadow: var(--shadow-soft); }
.zoom-crop img {
  position: absolute;
  top: 0;
  left: 0;
  max-width: none; /* <- to naprawia „wycina się więcej niż zaznaczone” */
  height: auto;
}
.zoom-title { font-weight: 600; font-family: var(--font-head); color: var(--color-ink); }
.zoom-sub { color: var(--color-ink-faded); display: flex; align-items: center; gap: 8px; }
.zoom-sub .dot::before { content: '•'; color: var(--color-ink-faded); }

/* Scrollbary */
.cover-grid::-webkit-scrollbar, .thumbs-wrapper::-webkit-scrollbar { height: 8px; width: 8px; }
.cover-grid::-webkit-scrollbar-thumb, .thumbs-wrapper::-webkit-scrollbar-thumb { background-color: var(--border); border-radius: 8px; }
.cover-grid::-webkit-scrollbar-track, .thumbs-wrapper::-webkit-scrollbar-track { background-color: transparent; }

/* Przejścia */
.view-fade-enter-active, .view-fade-leave-active { transition: opacity var(--transition-1) ease; }
.view-fade-enter-from, .view-fade-leave-to { opacity: 0; }

/* Responsywność */
@media (max-width: 980px) {
  .viewer-body { grid-template-columns: 1fr; max-height: calc(100vh - 100px); }
  .page-stage img { max-height: 62vh; }
}
</style>