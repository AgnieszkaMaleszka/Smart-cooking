<!-- src/components/modals/ConfirmDeleteModal.vue -->
<template>
  <div
    v-if="open"
    class="confirm-overlay"
    role="dialog"
    aria-modal="true"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
    tabindex="0"
  >
    <div class="confirm-card" role="document">
      <div class="confirm-header">
        <div class="icon" aria-hidden="true">
          <!-- ta sama „trash-2” co w ListCard -->
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M3 6h18" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </div>
        <strong>Usuń listę?</strong>
      </div>

      <p class="confirm-text" v-if="list">
        Na pewno chcesz usunąć listę <strong>{{ list.storeName }}</strong>
        ({{ (list.items || []).length }} pozycji)? Tej operacji nie można cofnąć.
      </p>

      <div class="confirm-actions">
        <button class="btn btn-outline" @click="$emit('cancel')">Anuluj</button>
        <button class="btn btn-danger" @click="$emit('confirm')">
          <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M3 6h18" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          Usuń
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  list: { type: Object, default: null }
})
defineEmits(['cancel','confirm'])
</script>

<style scoped>
.confirm-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,.45);
  display: grid; place-items: center;
  backdrop-filter: blur(2px);
}

.confirm-card {
  width: min(520px, 92vw);
  background: #fff;
  border: 1px solid rgba(10,64,12,.12);
  border-radius: 16px;
  box-shadow: var(--shadow-card, 0 18px 50px rgba(0,0,0,.15));
  padding: 16px;
}

.confirm-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 8px; color: var(--color-ink);
}

.confirm-header .icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(220,38,38,.08); color: #b91c1c;
  display: grid; place-items: center;
  line-height: 0;
}
.confirm-header .icon svg {
  width: 18px; height: 18px; display: block;
  stroke: currentColor; fill: none; stroke-width: 1.75;
  stroke-linecap: round; stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
}

.confirm-text { margin: 0 0 16px; color: var(--color-ink); opacity: .9; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }

.btn.btn-outline {
  padding: 8px 12px; border-radius: 10px;
  background: #fff; border: 1px solid rgba(10,64,12,.18);
  cursor: pointer; font-weight: 700;
}

.btn.btn-danger {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 10px;
  background: #dc2626; color: #fff; border: 1px solid rgba(220,38,38,.6);
  cursor: pointer; font-weight: 800;
}
.btn.btn-danger:hover { filter: brightness(.95); }

.btn-icon {
  width: 16px; height: 16px; display: block;
  stroke: currentColor; fill: none; stroke-width: 1.75;
  stroke-linecap: round; stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
}
</style>
