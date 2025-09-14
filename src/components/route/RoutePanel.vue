<template>
  <section class="route-hero">
    <div class="route-toolbar">
      <div class="toolbar-left">
        <!-- Tryb podróży -->
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
            @click="$emit('update:mode','walk')"
          ><span class="material-icons" style="font-size: 18px; margin-right: 4px;">directions_walk</span>Pieszo</button>
          <button
            :class="['segmented__btn', mode==='car' && 'is-active']"
            role="tab"
            :aria-selected="mode==='car'"
            title="Tryb samochód"
            @click="$emit('update:mode','car')"
          ><span class="material-icons" style="font-size: 18px; margin-right: 4px;">directions_car</span>Samochód</button>
        </div>

        <!-- Cel trasy -->
        <div class="segmented segmented--objectives" :disabled="routeBuilding">
          <button
            :class="['segmented__btn', objective==='shortest' && 'is-active']"
            @click="$emit('update:objective','shortest')"
            title="Najkrótsza trasa"
          >Najkrótsza</button>
          <button
            :class="['segmented__btn', objective==='light' && 'is-active']"
            @click="$emit('update:objective','light')"
            title="Najpierw lżejsze zakupy"
          >Nie dźwigamy</button>
          <button
            :class="['segmented__btn', objective==='priority' && 'is-active']"
            @click="$emit('update:objective','priority')"
            title="Uwzględnij priorytety"
          >Priorytety</button>
        </div>
      </div>

      <div class="toolbar-right">
        <span class="start-pill" :title="startLabel">Start: {{ startLabel }}</span>
        <button
          class="btn btn-primary btn--stable btn--build"
          :disabled="!selectedLists.length || routeBuilding"
          @click="$emit('build-route')"
        >
          <span class="btn__content" :style="{ opacity: routeBuilding ? 0 : 1 }">Ułóż trasę</span>
          <span v-if="routeBuilding" class="spinner" aria-hidden="true"></span>
          <span class="sr-only" aria-live="polite">{{ routeBuilding ? 'Buduję trasę…' : '' }}</span>
        </button>
      </div>
    </div>

    <!-- Priorytety -->
    <div class="route-controls" v-if="objective==='priority'">
      <div class="stack-row">
        <label class="label">Priorytety z gazetek</label>
        <div class="chip-group">
          <button
            v-for="tag in priorityTags"
            :key="tag"
            :class="['chip-btn', selectedPriorities.includes(tag) && 'is-active']"
            @click="$emit('toggle-priority', tag)"
            style="font-weight: 700; font-size: 14px;"
          >{{ tag }}</button>
        </div>
        <small class="muted">Wybierz produkty z promocji (na podstawie Twoich list).</small>
      </div>
    </div>

    <!-- Autocomplete nad mapą -->
    <section class="map-controls" role="region" aria-label="Ustaw punkt startowy">
      <ControlsAutocomplete
        v-model:query="searchQueryLocal"
        :center="center"
        :nominatim-base="nominatimBase"
        :photon-base="photonBase"
        :nominatim-email="nominatimEmail"
        @chosen="$emit('suggestion-chosen', $event)"
        @locate="$emit('locate', $event)"
        @close="() => {}"
      />
    </section>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import ControlsAutocomplete from '../ControlsAutocomplete.vue'

const props = defineProps({
  mode: { type: String, required: true },
  modeIndex: { type: Number, required: true },
  objective: { type: String, required: true },
  routeBuilding: { type: Boolean, required: true },
  selectedLists: { type: Array, required: true },
  startLabel: { type: String, required: true },

  priorityTags: { type: Array, required: true },
  selectedPriorities: { type: Array, required: true },

  waypoints: { type: Array, required: true },
  stepDistances: { type: Array, required: true },
  formatKm: { type: Function, required: true },

  // Autocomplete
  searchQuery: { type: String, required: true },
  center: { type: Object, required: true },
  nominatimBase: { type: String, required: true },
  photonBase: { type: String, required: true },
  nominatimEmail: { type: String, required: true },
})
const emits = defineEmits(['update:mode','update:objective','toggle-priority','build-route','suggestion-chosen','locate','update:searchQuery'])

const searchQueryLocal = computed({
  get: () => props.searchQuery,
  set: v => emits('update:searchQuery', v)
})
</script>

<style scoped>
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
.segmented {
  display: inline-flex; gap: 4px; padding: 4px;
  background: rgba(10,64,12,0.02);
  border: 1px solid rgba(10,64,12,0.06);
  border-radius: 999px; 
  box-shadow: none;
}
.segmented--objectives { padding: 4px; }
.segmented__btn {
  appearance:none; border:0; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: transparent; color: var(--color-ink); font-weight: 700; font-size: 14px;
  transition: background-color var(--transition-1), transform var(--transition-1), color var(--transition-1);
}
.segmented__btn:hover { background: rgba(10,64,12,0.04); }
.segmented__btn.is-active {
  background: var(--color-ink);
  color: #fff;
  box-shadow: 0 4px 10px rgba(10,64,12,.1);
}

.segmented--slider {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  overflow: hidden;
}
.segmented--slider .segmented__thumb {
  position: absolute; z-index: 0;
  top: 4px; left: 4px; bottom: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  background: var(--color-ink);
  box-shadow: 0 4px 10px rgba(10,64,12,.1);
  transform: translateX(calc(var(--i, 0) * (100% + 4px)));
  transition: transform .24s cubic-bezier(.2,.7,.2,1), background-color var(--transition-1);
}
.segmented--slider .segmented__btn { position: relative; z-index: 1; }

/* Chipy */
.chip-group { display: flex; gap: 8px; flex-wrap: wrap; }
.chip-btn {
  appearance: none; border: 0; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: rgba(10,64,12,0.02);
  color: var(--color-ink); font-weight: 700; font-size: 14px;
  transition: background-color var(--transition-1), color var(--transition-1), box-shadow var(--transition-1);
  box-shadow: none;
}
.chip-btn:hover { background: rgba(10,64,12,0.04); }
.chip-btn.is-active {
  background: var(--color-ink);
  color: #fff;
  box-shadow: 0 4px 10px rgba(10,64,12,.1);
}

/* Autocomplete nad mapą */
.map-controls {
  margin: 0;
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  display: flex;
  align-items: center;
}

/* Stabilny przycisk */
.btn--stable {
  height: 44px;
  min-width: 120px;
  display: inline-flex; align-items: center; justify-content: center;
  transform: none !important;
  font-weight: 700;
  font-size: 14px;
}
.btn--build { position: relative; }

.btn--build .spinner{
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,.6);
  border-top-color: #fff;
  animation: btnspin .9s linear infinite;
}
@keyframes btnspin{
  0%   { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}
.btn__content { display: inline-block; transition: opacity .18s ease; }

.sr-only {
  position:absolute !important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
}
</style>
