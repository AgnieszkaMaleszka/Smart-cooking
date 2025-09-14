<template>
  <div :class="styles.controls" ref="rootEl">
    <input
      v-model="model"
      @input="onSearchInput"
      @keydown.down.prevent="moveActive(1)"
      @keydown.up.prevent="moveActive(-1)"
      @keydown.enter.prevent="enterActive()"
      :class="styles.autocomplete"
      placeholder="Wpisz adres"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      :aria-activedescendant="activeId || undefined"
    />

    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <button :class="styles.locateButton" @click="locateMe">
      <span class="material-icons" style="font-size: 20px; margin-right: 6px;">my_location</span>
      Lokalizuj mnie
    </button>

    <ul v-if="suggestions.length" :class="styles.suggestions" role="listbox">
      <li
        v-for="(s, i) in suggestions"
        :key="s.place_id"
        :id="`sug-${i}`"
        :class="[styles.suggestionsItem, i === activeIndex ? styles.active : '']"
        role="option"
        :aria-selected="i === activeIndex"
        @mouseenter="setActive(i)"
        @mousedown.prevent="chooseSuggestion(s)"
      >
        {{ s.display_name }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import styles from '../styles/controls.module.css'
import { useGeocoding } from '../composables/useGeocoding.js'

const props = defineProps({
  center: { type: Object, required: true },           // {lat, lng}
  nominatimBase: { type: String, required: true },
  photonBase: { type: String, required: true },
  nominatimEmail: { type: String, default: '' },
  query: { type: String, default: '' }
})
const emit = defineEmits(['update:query', 'chosen', 'locate', 'close'])

const rootEl = ref(null)                // <— ref do korzenia (ważne przy CSS Modules)
const model = ref(props.query)
watch(() => props.query, v => { if (v !== model.value) model.value = v })
watch(model, v => emit('update:query', v))

const suggestions = ref([])
const activeIndex = ref(-1)
const activeId = ref(null)
const isOpen = computed(() => suggestions.value.length > 0)

const { fetchSuggestions } = useGeocoding({
  nominatimBase: props.nominatimBase,
  photonBase: props.photonBase,
  nominatimEmail: props.nominatimEmail
})

let debounceId = null
let activeAbort = null

const sanitizeQuery = raw => (raw ? raw.trim().replace(/[,\.\s;:]+$/g, '') : '')
const shouldWaitMoreTyping = raw => /[,\s]$/.test(raw || '')

function setActive(i) {
  activeIndex.value = i
  activeId.value = `sug-${i}`
}

function moveActive(delta) {
  if (!suggestions.value.length) return
  const n = suggestions.value.length
  activeIndex.value = (((activeIndex.value + delta) % n) + n) % n
  activeId.value = `sug-${activeIndex.value}`
}

function enterActive() {
  if (activeIndex.value < 0 || activeIndex.value >= suggestions.value.length) return
  chooseSuggestion(suggestions.value[activeIndex.value])
}

function closeSuggestions() {
  if (!suggestions.value.length) return
  suggestions.value = []
  activeIndex.value = -1
  activeId.value = null
  emit('close')
}

async function onSearchInput() {
  clearTimeout(debounceId)
  const raw = model.value
  const q = sanitizeQuery(raw)
  if (!q || q.length < 3 || shouldWaitMoreTyping(raw)) {
    closeSuggestions()
    if (activeAbort) activeAbort.abort()
    return
  }
  debounceId = setTimeout(() => doFetch(q), 400)
}

async function doFetch(q) {
  const around = { lat: props.center.lat, lng: props.center.lng }
  const { list, controller } = await fetchSuggestions({ q, around, previous: activeAbort })
  activeAbort = controller
  suggestions.value = list
  activeIndex.value = list.length ? 0 : -1
  activeId.value = activeIndex.value >= 0 ? `sug-${activeIndex.value}` : null
}

function chooseSuggestion(s) {
  closeSuggestions()
  model.value = s.display_name
  emit('chosen', { lat: s.lat, lon: s.lon, raw: s })
}

async function locateMe() {
  const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  const isHttps = location.protocol === 'https:'
  if (!isLocalhost && !isHttps) {
    emit('locate', { error: 'Dla lokalizacji użyj HTTPS lub uruchom na http://localhost.' })
    return
  }
  if (!('geolocation' in navigator)) {
    emit('locate', { error: 'Twoja przeglądarka nie wspiera geolokalizacji.' })
    return
  }
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' })
      if (status.state === 'denied') {
        emit('locate', { error: 'Dostęp do lokalizacji zablokowany – włącz uprawnienia w przeglądarce.' })
        return
      }
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        emit('locate', { lat, lng, accuracy })
      },
      err => {
        const msg =
          err.code === 1 ? 'Odmowa dostępu do lokalizacji.' :
          err.code === 2 ? 'Nie można ustalić lokalizacji.' :
          err.code === 3 ? 'Przekroczono czas oczekiwania.' :
          `Błąd lokalizacji: ${err.message || 'nieznany'}`
        emit('locate', { error: msg })
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  } catch {
    emit('locate', { error: 'Wystąpił błąd geolokalizacji.' })
  }
}

/* === Zamknięcie ESC + klik poza ======================================= */

function handleGlobalKeyDown(e) {
  if (e.key !== 'Escape') return
  if (isOpen.value) {
    // jeśli lista otwarta — zamknij
    closeSuggestions()
  } else if (model.value) {
    // jeśli zamknięta — potraktuj ESC jako "anuluj wpisywanie"
    model.value = ''
  }
}

function handleClickOutside(e) {
  const el = rootEl.value
  if (!el) return
  if (!el.contains(e.target)) {
    closeSuggestions()
  }
}

onMounted(() => {
  // używamy pointerdown w "capture", by zadziałało zanim mousedown na innych elementach
  document.addEventListener('pointerdown', handleClickOutside, true)
  document.addEventListener('keydown', handleGlobalKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleClickOutside, true)
  document.removeEventListener('keydown', handleGlobalKeyDown)
})
</script>
