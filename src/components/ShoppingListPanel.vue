<!-- src/components/ShoppingListPanel.vue -->
<template>
  <aside
    v-if="open"
    class="shopping-panel"
    aria-label="Lista zakupów"
    role="complementary"
  >
    <header class="list-header">
      <div class="header-row-1">
        <div class="list-title">
          Lista zakupów <span class="muted">dla tej gazetki</span>
        </div>
      </div>

      <div class="list-actions">
        <div class="search">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M21 21l-4.2-4.2M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          </svg>
          <input v-model.trim="query" class="input search-input" placeholder="Szukaj..." aria-label="Szukaj na liście" />
        </div>

        <select v-model="sort" class="select" aria-label="Sortowanie">
          <option value="recent">Najnowsze</option>
          <option value="az">A–Z</option>
          <option value="page">Strona</option>
        </select>

        <button class="btn-with-icon" @click="onExport" :disabled="exportingPDF || !filteredSorted.length">
          <svg v-if="!exportingPDF" viewBox="0 0 24 24" width="16" height="16">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" 
                  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2v6h6M10 12h4M10 16h4" 
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else class="spinner" viewBox="0 0 24 24" width="16" height="16">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.25"/>
            <path d="M12 2a10 10 0 019.54 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          </svg>
          <span class="btn-label">{{ exportingPDF ? 'Generuję...' : 'Eksportuj PDF' }}</span>
        </button>
      </div>
    </header>

    <!-- EMPTY STATE -->
    <div v-if="!selections.length" class="list-empty">
      <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
        <path d="M9 2L7.17 4H3v2h18V4h-4.17L15 2H9zm2 7v9m-4-9v9m8-9v9" 
              stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>
      <p class="empty-message">Lista jest pusta</p>
      <p class="empty-hint">Włącz „Zaznacz" i przeciągnij po produkcie, aby dodać do listy</p>
    </div>

    <ul v-else class="list-items">
      <li
        v-for="sel in filteredSorted"
        :key="sel.id"
        class="list-item"
        :class="{ selected: sel.id === selectedId, done: !!sel.done }"
      >
        <button
          class="preview"
          :style="cropContainerStyle(sel)"
          @click="openLightbox(sel)"
          title="Powiększ podgląd"
        >
          <img 
            :src="proxiedPages[sel.page]" 
            :style="cropImageStyle(sel)" 
            :alt="`Podgląd: ${sel.title || 'Produkt'}`"
            :data-selection-id="sel.id"
            loading="lazy"
          />
        </button>

        <div
          class="content"
          @mouseenter="$emit('hover', sel.id)"
          @mouseleave="$emit('hover-end')"
          @click="$emit('update:selectedId', sel.id)"
        >
        <div class="title-row">
          <input
            class="input title"
            v-model.trim="sel.title"
            placeholder="Nazwa produktu"
            @change="$emit('change')"
            @click.stop
            aria-label="Nazwa produktu"
          />

          <label class="checkbox-done" @click.stop>
            <input 
              type="checkbox" 
              v-model="sel.done" 
              @change="$emit('change')"
              aria-label="Oznacz jako kupione"
            />
            <span class="checkbox-icon">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" 
                      fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </label>
        </div>

          <div class="row">
              <!-- ILOŚĆ (szt.) — NEW -->
              <input
                class="input qty"
                v-model.number="sel.qty"
                type="number"
                min="1"
                step="1"
                placeholder="Ilość"
                inputmode="numeric"
                aria-label="Ilość sztuk"
                @change="$emit('change')"
                @click.stop
              />

              <!-- WAGA (g) — NEW -->
              <div class="weight-wrap">
                <input
                  class="input weight"
                  v-model.number="sel.weight"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Waga (g)"
                  inputmode="numeric"
                  aria-label="Waga w gramach"
                  @change="$emit('change')"
                  @click.stop
                />
                <span class="unit">g</span>
              </div>

              <!-- CENA (było) -->
            <input
              class="input price"
              v-model.trim="sel.price"
              placeholder="12,99 zł"
              inputmode="decimal"
              aria-label="Cena"
              @change="$emit('change')"
              @click.stop
            />

            <div class="action-buttons">
              <button 
                class="btn-mini"
                @click.stop="$emit('goto', sel)"
                title="Pokaż na stronie"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" fill="currentColor"/>
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                        stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
              </button>
              
              <button 
                class="btn-mini btn-danger"
                @click.stop="$emit('remove', sel)"
                title="Usuń z listy"
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="meta-row">
            <div class="shop-chip" :title="shop?.shopName">
              <img v-if="shopLogo" :src="shopLogo" alt="" />
              <span v-else class="mono">{{ shopInitials }}</span>
              <span class="name">{{ shop?.shopName }}</span>
            </div>
            <span class="dot"></span>
            <span class="muted">{{ formatDate(sel.at) }}</span>
            <span class="dot"></span>
            <span class="muted">{{ validity }}</span>
            <span class="dot"></span>
            <span class="muted">Str. {{ sel.page + 1 }}</span>
          </div>
        </div>
      </li>
    </ul>

    <footer v-if="selections.length" class="list-summary" aria-live="polite">
      <div class="sum-left">
        <svg viewBox="0 0 24 24" width="16" height="16" class="sum-icon">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Pozycji: <strong>{{ filteredSorted.length }}</strong>
      </div>
      <div class="sum-right" v-if="totalPrice !== null">
        <svg viewBox="0 0 24 24" width="16" height="16" class="sum-icon">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" 
                stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Suma: <strong>{{ formatCurrency(totalPrice) }}</strong>
      </div>
    </footer>

    <!-- LIGHTBOX -->
    <ImageLightbox
      :open="lbOpen"
      :selection="lbSel"
      :pages="proxiedPages"
      @close="lbOpen = false"
    />
  </aside>
</template>

<script>
import { exportShoppingListPDF } from '../utils/pdfExporter'
import { proxifyImage } from '../utils/imageProxy'
import ImageLightbox from '../components/ImageLightbox.vue'

export default {
  name: 'ShoppingListPanel',
  components: { ImageLightbox },
  props: {
    open: { type: Boolean, default: false },
    selections: { type: Array, default: () => [] },
    pages: { type: Array, default: () => [] },
    shop: { type: Object, default: null },
    validity: { type: String, default: 'Aktualna' },
    selectedId: { type: String, default: null },
    pageMeta: { type: Object, default: () => ({}) }
  },
  emits: [
    'update:open',
    'update:selectedId',
    'hover', 'hover-end',
    'goto', 'remove', 'change'
  ],
  data() {
    return {
      query: '',
      sort: 'recent',
      exportingPDF: false,
      lbOpen: false,
      lbSel: null
    }
  },
  computed: {
    proxiedPages() {
      return (this.pages || []).map((p) => proxifyImage(p))
    },
    filteredSorted() {
      let arr = Array.isArray(this.selections) ? this.selections.slice() : []

      const q = this.query.trim().toLowerCase()
      if (q) {
        arr = arr.filter(s =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.price || '').toLowerCase().includes(q) ||
          String((s.page || 0) + 1).includes(q)
        )
      }

      if (this.sort === 'az') {
        arr.sort((a, b) => (a.title || 'Produkt').localeCompare(b.title || 'Produkt', 'pl'))
      } else if (this.sort === 'page') {
        arr.sort((a, b) => (a.page - b.page) || (b.at - a.at))
      } else {
        arr.sort((a, b) => b.at - a.at)
      }
      return arr
    },
    totalPrice() {
      const nums = (this.selections || [])
        .filter(s => !s.done)
        .map(s => this.parsePrice(s.price))
        .filter(v => typeof v === 'number' && !isNaN(v))
      if (!nums.length) return null
      return nums.reduce((a, b) => a + b, 0)
    },
    shopLogo() {
      return this.shop?.logo || this.shop?.logoUrl || this.shop?.image || ''
    },
    shopInitials() {
      const n = (this.shop?.shopName || '').trim()
      return n ? n[0].toUpperCase() : 'S'
    }
  },
  methods: {
    openLightbox(sel) {
      // pokaż *pełny wycinek* dopasowany do okna (bez konieczności przesuwania)
      this.lbSel = sel
      this.lbOpen = true
    },
    cropContainerStyle(sel) {
      const r = sel.rect || { w: 50, h: 50 }
      void r
      return {
        position: 'relative',
        aspectRatio: '1 / 1',
        width: '72px',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)'
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
        maxWidth: 'none',
        height: 'auto',
        transformOrigin: 'top left',
        transform: `translate(${-r.x}%, ${-r.y}%)`,
        willChange: 'transform'
      }
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
        return new Intl.NumberFormat('pl-PL', { 
          style: 'currency', 
          currency: 'PLN', 
          maximumFractionDigits: 2 
        }).format(v)
      } catch {
        return `${Number(v || 0).toFixed(2)} zł`
      }
    },
    formatDate(tsOrDate) {
      const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate)
      if (isNaN(d)) return '—'
      const today = new Date()
      const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24))
      if (diff === 0) return 'Dziś'
      if (diff === 1) return 'Wczoraj'
      if (diff < 7) return `${diff} dni temu`
      return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
    },
    async onExport() {
      if (this.exportingPDF) return
      this.exportingPDF = true
      try {
        const activeItems = this.filteredSorted.filter(s => !s.done)
        await exportShoppingListPDF(activeItems, {
          shopName: this.shop?.shopName || 'Sklep',
          address: this.shop?.address || '',
          pages: this.proxiedPages
        })
      } catch (e) {
        console.error('PDF export error', e)
        alert('Wystąpił błąd podczas generowania PDF.')
      } finally {
        this.exportingPDF = false
      }
    }
  }
}
</script>

<style scoped>
/* (style UI listy jak poprzednio) */
.shopping-panel {
  --border: rgba(10, 64, 12, 0.12);
  --border-subtle: rgba(10, 64, 12, 0.08);
  --color-ink-faded: rgba(10, 64, 12, 0.6);
  --color-paper-green-faded: rgba(238, 246, 239, 0.5);
}

.shopping-panel { position: relative; height: 100%; width: 100%; border-left: 1px solid var(--border); background: var(--color-paper); box-shadow: var(--shadow-card); display: grid; grid-template-rows: auto 1fr auto; min-height: 0; overflow: hidden; z-index: 1; }
.list-header { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border-bottom: 1px dashed var(--border-subtle); position: sticky; top: 0; background: var(--color-paper); z-index: 2; }
.header-row-1 { display: flex; align-items: center; }
.list-title { font-family: var(--font-head); font-weight: 600; color: var(--color-ink); font-size: 1.1rem; display: flex; align-items: baseline; gap: var(--space-1); }
.muted { color: var(--color-ink-soft); font-family: var(--font-body); font-weight: 400; font-size: .9em; }
.list-actions { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.search { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 5px 9px; background: var(--color-paper); box-shadow: var(--shadow-soft); flex: 1; min-width: 160px; }
.search svg { color: var(--color-ink-soft); }
.search-input { border: none !important; padding: 0 !important; outline: none; background: transparent; color: var(--color-ink); font-family: var(--font-body); flex-grow: 1; min-width: 0; }
.select { border: 1px solid var(--border-subtle); background: var(--color-paper); border-radius: var(--radius-md); padding: 5px 9px; font-weight: 500; color: var(--color-ink); font-family: var(--font-body); box-shadow: var(--shadow-soft); }
.btn-with-icon { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; background: var(--color-paper); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--color-accent); font-weight: 500; cursor: pointer; transition: var(--transition-1); }
.btn-with-icon:hover:not(:disabled) { background: rgba(179, 150, 89, 0.1); border-color: var(--color-accent); }
.btn-with-icon:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.btn-label { display: none; } @media (min-width: 480px) { .btn-label { display: inline; } }

.list-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-4); text-align: center; }
.empty-icon { color: var(--color-sage); margin-bottom: var(--space-3); }
.empty-message { margin: 0 0 var(--space-2); font-size: 1.1rem; font-weight: 600; color: var(--color-ink); font-family: var(--font-head); }
.empty-hint { margin: 0; font-size: 0.9rem; color: var(--color-ink-soft); max-width: 280px; font-family: var(--font-body); }

.list-items { list-style: none; margin: 0; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); overflow-y: auto; }
.list-item { display: grid; grid-template-columns: 72px 1fr; align-items: start; gap: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-3); background: var(--color-paper-green-faded); transition: background-color var(--transition-1), border-color var(--transition-1); }
.list-item:hover { background: var(--color-paper-green); }
.list-item.selected { outline: 2px solid var(--color-accent); outline-offset: 2px; }
.list-item.done { opacity: .75; }
.list-item.done .title { text-decoration: line-through; color: var(--color-ink-faded); }

.preview { flex-shrink: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--color-paper); padding: 0; overflow: hidden; cursor: zoom-in; display: inline-block; position: relative; width: 72px; height: 72px; aspect-ratio: 1/1; box-shadow: var(--shadow-soft); }
.preview img { display: block; max-width: none; height: 100%; object-fit: cover; }

.content { display: flex; flex-direction: column; gap: var(--space-2); flex-grow: 1; min-width: 0; }
.title-row { display: flex; align-items: center; gap: var(--space-2); }
.content .input { border: 1px solid var(--border-subtle); background: var(--color-paper); border-radius: var(--radius-md); padding: 6px 10px; font-size: .95rem; color: var(--color-ink); font-family: var(--font-body); box-shadow: var(--shadow-soft); min-width: 0; }
.content .title { font-weight: 500; font-family: var(--font-head); flex-grow: 1; }

.checkbox-done { flex-shrink: 0; width: 24px; height: 24px; position: relative; cursor: pointer; }
.checkbox-done input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.checkbox-icon { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 2px solid var(--color-sage); border-radius: var(--radius-sm); background: var(--color-paper); transition: var(--transition-1); }
.checkbox-icon svg { opacity: 0; color: white; transform: scale(0.8); transition: var(--transition-1); }
.checkbox-done input:checked + .checkbox-icon { background: var(--color-accent); border-color: var(--color-accent); }
.checkbox-done input:checked + .checkbox-icon svg { opacity: 1; transform: scale(1); }

.row { display: flex; gap: var(--space-2); align-items: center; }
.input.price { width: 100px; flex-shrink: 0; }
.action-buttons { display: flex; gap: var(--space-1); margin-left: auto; }

.btn-mini { width: 28px; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--color-paper); color: var(--color-ink-soft); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: var(--transition-1); }
.btn-mini:hover { background: var(--color-sage-2); color: var(--color-ink); border-color: var(--color-sage); }
.btn-mini.btn-danger:hover { background: rgba(220, 38, 38, 0.1); border-color: rgba(220, 38, 38, 0.3); color: #dc2626; }

.meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--color-ink-faded); font-size: 13px; font-family: var(--font-body); }
.meta-row .name, .meta-row .muted { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dot::before { content: '•'; color: var(--color-ink-faded); }

.shop-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--color-sage-2); border-radius: var(--radius-md); padding: 4px 8px; font-size: 12px; border: 1px solid var(--border-subtle); }
.shop-chip img { width: 20px; height: 20px; border-radius: var(--radius-sm); object-fit: contain; background: var(--color-paper); border: 1px solid var(--border-subtle); }
.shop-chip .mono { width: 20px; height: 20px; border-radius: var(--radius-sm); display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; background: var(--color-paper); color: var(--color-ink); font-family: var(--font-head); }
.shop-chip .name { font-weight: 600; color: var(--color-ink); font-family: var(--font-body); }

.list-summary { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3); border-top: 1px dashed var(--border-subtle); background: var(--color-paper); position: sticky; bottom: 0; z-index: 1; }
.sum-left, .sum-right { display: flex; align-items: center; gap: var(--space-1); }
.sum-icon { color: var(--color-accent); }
.list-summary strong { font-weight: 600; color: var(--color-ink); font-family: var(--font-head); }

.list-items::-webkit-scrollbar { width: 8px; }
.list-items::-webkit-scrollbar-thumb { background-color: var(--color-sage); border-radius: 8px; }
.list-items::-webkit-scrollbar-track { background-color: transparent; }
/* --- ilość / waga (g) --- */
.input.qty {
  width: 76px;
  text-align: center;
}

.weight-wrap {
  position: relative;
}
.input.weight {
  width: 120px;
  padding-right: 22px; /* miejsce na sufiks g */
}
.weight-wrap .unit {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--color-ink-faded);
  pointer-events: none;
}


@media (max-width: 768px) {
  .list-header { padding: var(--space-2); }
  .list-actions { width: 100%; }
  .search { width: 100%; }
  .list-item { padding: var(--space-2); gap: var(--space-2); }
  .preview { width: 60px; height: 60px; }
  .meta-row { font-size: 12px; }
  .input.qty { width: 64px; }
  .input.weight { width: 100px; }
}
</style>
