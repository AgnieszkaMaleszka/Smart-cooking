<!-- src/components/ImageLightbox.vue -->
<template>
  <teleport to="body">
    <div
      v-if="open"
      class="lb-overlay"
      @click.self="close"
      @keydown.esc="close"
      tabindex="-1"
      ref="overlay"
      aria-modal="true"
      role="dialog"
      :aria-label="ariaLabel"
    >
      <div class="lb-dialog" ref="dialog">
        <header class="lb-header">
          <div class="lb-title">
            {{ title || 'Podgląd wycinka' }}
            <span v-if="meta" class="lb-meta">• {{ meta }}</span>
          </div>
          <button class="lb-close" @click="close" aria-label="Zamknij">
            ✕
          </button>
        </header>

        <div class="lb-content">
          <img
            v-if="dataUrl"
            class="lb-image"
            :src="dataUrl"
            alt=""
            :style="imgStyle"
            @load="loaded = true"
          />
          <div v-else class="lb-placeholder">Ładowanie podglądu…</div>
        </div>

        <footer class="lb-footer">
          <button class="lb-btn" @click="zoomOut" :disabled="zoom <= 0.6">−</button>
          <span class="lb-zoom">{{ Math.round(zoom * 100) }}%</span>
          <button class="lb-btn" @click="zoomIn" :disabled="zoom >= 2.0">＋</button>
          <div class="lb-spacer"></div>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<script>
import { ref, watch, computed, onMounted } from 'vue'
import { cropToDataURL } from '../utils/cropToDataUrl'
import { proxifyImage } from '../utils/imageProxy'

export default {
  name: 'ImageLightbox',
  props: {
    open: { type: Boolean, default: false },
    // selection: { id, page, rect, title?, price?, at? }
    selection: { type: Object, default: null },
    pages: { type: Array, default: () => [] },
    maxSide: { type: Number, default: 1400 } // kontrola ostrości/rozmiaru
  },
  emits: ['close'],
  setup(props, { emit }) {
    const dataUrl = ref('')
    const loaded  = ref(false)
    const zoom    = ref(1)

    const title = computed(() => props.selection?.title || '')
    const meta = computed(() => {
      if (!props.selection) return ''
      const page = Number(props.selection.page) + 1
      const when = formatDate(props.selection.at)
      return `Str. ${page} • ${when}`
    })
    const ariaLabel = computed(() => title.value || 'Podgląd wycinka')

    const imgStyle = computed(() => ({
      transform: `scale(${zoom.value})`
    }))

    const buildData = async () => {
      dataUrl.value = ''
      loaded.value = false
      zoom.value = 1
      try {
        const pageUrl = proxifyImage(props.pages?.[props.selection?.page] || '')
        const url = await cropToDataURL(pageUrl, props.selection?.rect, {
          maxSide: props.maxSide,
          background: '#FFFFFF'
        })
        dataUrl.value = url
      } catch (e) {
        console.error('Lightbox: nie udało się przygotować podglądu', e)
        dataUrl.value = ''
      }
    }

    const close = () => emit('close')
    const zoomIn = () => (zoom.value = Math.min(2, +(zoom.value + 0.1).toFixed(2)))
    const zoomOut = () => (zoom.value = Math.max(0.6, +(zoom.value - 0.1).toFixed(2)))

    watch(() => props.open, (o) => { if (o) buildData() })
    watch(() => props.selection, () => { if (props.open) buildData() })

    onMounted(() => {
      // fokus na overlay, by działał Esc
      // eslint-disable-next-line no-unused-expressions
      document && setTimeout(() => overlayRef.value?.focus?.(), 0)
    })

    const overlayRef = ref(null)
    const dialogRef = ref(null)

    return {
      dataUrl, loaded, zoom,
      imgStyle, title, meta, ariaLabel,
      close, zoomIn, zoomOut,
      overlay: overlayRef, dialog: dialogRef
    }
  }
}

function formatDate(tsOrDate) {
  const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate)
  if (isNaN(d)) return '—'
  const today = new Date()
  const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Dziś'
  if (diff === 1) return 'Wczoraj'
  if (diff < 7) return `${diff} dni temu`
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.lb-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.55);
  display: grid; place-items: center;
  z-index: 1000;
}
.lb-dialog {
  width: min(92vw, 980px);
  max-height: 92vh;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  display: grid;
  grid-template-rows: auto 1fr auto;
  overflow: hidden;
}
.lb-header {
  padding: 10px 14px;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(0,0,0,.08);
}
.lb-title { font-weight: 600; color: #0A400C; }
.lb-meta { color: #2E5A33; font-weight: 500; font-size: 12px; margin-left: 6px; }
.lb-close {
  border: 1px solid rgba(0,0,0,.12);
  background: #fff; border-radius: 8px; width: 30px; height: 30px; cursor: pointer;
}
.lb-content {
  display: grid; place-items: center;
  padding: 12px; overflow: auto; /* gdy ekstremalnie duże, wciąż zabezpieczenie */
  background: #f7f7f7;
}
.lb-image {
  max-width: min(88vw, 920px);
  max-height: 78vh;       /* ⬅️ gwarantuje, że CAŁY wycinek mieści się w oknie */
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.2);
  transform-origin: center center;
}
.lb-placeholder {
  padding: 40px; color: #2E5A33; background: #EEF6EF; border-radius: 10px;
}
.lb-footer {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-top: 1px solid rgba(0,0,0,.08);
}
.lb-btn {
  padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,.12);
  background: #fff; cursor: pointer; min-width: 36px;
}
.lb-btn:disabled { opacity: .5; cursor: not-allowed; }
.lb-zoom { min-width: 50px; text-align: center; }
.lb-spacer { flex: 1 1 auto; }
</style>
