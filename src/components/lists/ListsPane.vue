<template>
  <aside class="lists-pane" aria-label="Twoje listy zakupowe">
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
          :value="listsFilter"
          @input="$emit('update:listsFilter', $event.target.value)"
          placeholder="Szukaj w listach…"
          aria-label="Szukaj w listach"
        />
        <button
          class="btn btn-ghost btn--sm btn--stable"
          @click="$emit('toggle-select-all')"
          :disabled="!filteredLists.length"
          style="height: 44px;"
        >
          {{ allVisibleSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie' }}
        </button>
      </div>
    </header>

    <div class="lists-scroll">
      <!-- 1) Loading ma pierwszeństwo -->
      <div
        v-if="listsLoading"
        class="empty-state"
        role="status"
        aria-live="polite"
      >
        <img class="empty-state__icon" :src="defaultLogo" alt="" width="48" height="48" />
        <h3>Ładuję Twoje listy…</h3>
        <p class="muted">To nie powinno trwać długo. Jeśli trwa za długo — spróbuj ponownie.</p>
        <button class="btn btn-primary" @click="$emit('force-refresh')">Odśwież listy</button>
      </div>

      <!-- 2) Brak jakichkolwiek list -->
      <div v-else-if="!hasAnyLists" class="empty-state" role="status" aria-live="polite">
        <img class="empty-state__icon" :src="defaultLogo" alt="" width="48" height="48" />
        <h3>Brak aktualnych list zakupów</h3>
        <p class="muted">Nie masz jeszcze żadnej listy. Zacznij od przejrzenia bieżących promocji i dodaj produkty do nowej listy.</p>
        <a class="btn btn-primary" :href="promotionsUrl">Przeglądaj aktualne promocje</a>
      </div>

      <!-- 3) Listy są, ale filtr nic nie zwraca -->
      <p v-else-if="!filteredLists.length" class="muted empty" style="padding:12px">
        Brak wyników dla bieżącego filtra.
      </p>

      <!-- 4) Główna siatka kart -->
      <TransitionGroup v-else name="grid" tag="div" class="lists-grid" aria-live="polite">
        <ListCard
        v-for="list in filteredLists"
        :key="list.id"
        :list="list"
        :selected="selectedListIds.includes(list.id)"
        :logos-map="logosMap"
        :default-logo="defaultLogo"
        :format-price="formatPrice"
        :format-date="formatDate"
        :format-weight="formatWeight"
        :total-weight="sumWeight(list)"
        :total-price="sumPrice(list)"
        @toggle="$emit('toggle', list.id)"
        @request-delete="$emit('request-delete', list)"
        />
      </TransitionGroup>
    </div>
  </aside>
</template>

<script setup>
import ListCard from './ListCard.vue'

const props = defineProps({
  logosMap: { type: Object, required: true },
  defaultLogo: { type: String, required: true },

  listsLoading: { type: Boolean, required: true },
  listsFilter: { type: String, required: true },
  filteredLists: { type: Array, required: true },
  selectedListIds: { type: Array, required: true },
  allVisibleSelected: { type: Boolean, required: true },

  hasAnyLists: { type: Boolean, required: true },
  promotionsUrl: { type: String, default: '/prices' },

  formatPrice: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  formatWeight: { type: Function, required: true },
  sumPrice: { type: Function, required: true },
  sumWeight: { type: Function, required: true },
})

defineEmits([
  'update:listsFilter',
  'toggle-select-all',
  'toggle',
  'request-delete',
  'force-refresh'
])
</script>

<style scoped>
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
.input--sm:focus { border-color: rgba(10,64,12,.34); }

.lists-scroll { overflow-y: auto; padding: 16px; background: var(--color-paper); }
.lists-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }

/* Empty state */
.empty-state {
  margin: 12px auto;
  max-width: 560px;
  text-align: center;
  background: #fff;
  border: 1px dashed rgba(10,64,12,.18);
  border-radius: 14px;
  box-shadow: var(--shadow-soft);
  padding: 20px;
}
.empty-state__icon {
  display:block; margin: 0 auto 8px;
  border-radius: 10px;
  border: 1px solid rgba(10,64,12,.1);
  background: #fff;
}
.empty-state h3 { margin: 6px 0 6px; font-size: 18px; font-weight: 800; color: var(--color-ink); }
.empty-state p { margin: 0 0 12px; opacity: .85; }
.empty { text-align: center; }

/* Animacje */
.grid-enter-from, .grid-leave-to { opacity: 0; transform: translateY(6px) scale(.98); }
.grid-enter-active, .grid-leave-active { transition: .22s ease; }
.grid-move { transition: transform .22s ease; }
</style>
