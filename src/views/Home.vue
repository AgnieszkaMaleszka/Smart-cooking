<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Wyszukiwanie po składniku
const term = ref('')
const goSearch = () => {
  const q = term.value.trim()
  router.push(q ? `/filter?search=${encodeURIComponent(q)}` : '/filter')
}

// Lekkie, przewijane cytaty
const quotes = [
  { id: 'q1', text: 'Najlepsze przepisy rodzą się z prostych składników i odrobiny odwagi.', author: 'Smart Cooking' },
  { id: 'q2', text: 'Gotowanie to miłość, którą widać i czuć na talerzu.', author: 'Przysłowie' },
  { id: 'q3', text: 'Sezonowo i prosto — tak smakuje najlepiej.', author: 'Smart Cooking' },
  { id: 'q4', text: 'Oszczędzaj na zakupach, nie na smaku.', author: 'Smart Cooking' },
  { id: 'q5', text: 'Jeden dobry przepis potrafi uratować cały dzień.', author: 'Smart Cooking' }
]
const active = ref(0)
const paused = ref(false)
let timer

onMounted(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!reduce) {
    timer = setInterval(() => {
      if (!paused.value) active.value = (active.value + 1) % quotes.length
    }, 5000)
  }
})
onUnmounted(() => { if (timer) clearInterval(timer) })

const nextQuote = () => { active.value = (active.value + 1) % quotes.length }
const prevQuote = () => { active.value = (active.value - 1 + quotes.length) % quotes.length }
</script>

<template>
  <div class="home">
    <!-- HERO: tytuł + wyszukiwarka + dwie klarowne akcje -->
    <section class="hero-card">
      <h1 class="hero-title">Smart Cooking</h1>
      <div class="ornament" aria-hidden="true"></div>
      <p class="subtitle">Przepisy i okazje dopasowane do Twojego dnia.</p>

      <form class="search" @submit.prevent="goSearch" role="search" aria-label="Wyszukiwarka przepisów">
        <input
          v-model="term"
          type="text"
          placeholder="Wpisz składnik, np. „cukinia”"
          aria-label="Szukaj po składniku"
          autocomplete="off"
        />
        <button type="submit" class="btn btn-primary">Znajdź przepisy</button>
      </form>

      <div class="btn-group">
        <router-link to="/filter" class="btn btn-primary">Odkryj przepisy</router-link>
        <router-link to="/prices" class="btn btn-ghost">Zobacz promocje</router-link>
      </div>
    </section>

    <!-- Dwie karty „dlaczego warto” (te, które lubisz) -->
    <section class="section container">
      <div class="features two-cols">
        <router-link to="/filter" class="feature">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0A400C" stroke-width="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <h4>Szybko i prosto</h4>
          <p>Przepisy do 20 minut — idealne, gdy liczysz czas.</p>
        </router-link>

        <router-link to="/filter" class="feature">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0A400C" stroke-width="1.5">
              <path d="M3 5h18M6 5l4 6v6l4 2v-8l4-6" />
            </svg>
          </div>
          <h4>Gotuj z tego, co masz</h4>
          <p>Wpisz składniki z lodówki i znajdź dopasowane dania.</p>
        </router-link>
      </div>
    </section>

    <!-- Cytaty w klimacie książki (automatyczny rotator) -->
    <section class="section container">
      <div class="quotes" @mouseenter="paused = true" @mouseleave="paused = false">
        <transition name="fade-slide" mode="out-in">
          <figure class="quote" :key="quotes[active].id">
            <blockquote>“{{ quotes[active].text }}”</blockquote>
            <figcaption>— {{ quotes[active].author }}</figcaption>
          </figure>
        </transition>

        <div class="quote-controls" role="group" aria-label="Nawigacja po cytatach">
          <button class="quote-btn" @click="prevQuote" aria-label="Poprzedni cytat">‹</button>
          <div class="dots" aria-hidden="true">
            <span
              v-for="(q, i) in quotes"
              :key="q.id + i"
              class="dot"
              :class="{ active: i === active }"
              @click="active = i"
            />
          </div>
          <button class="quote-btn" @click="nextQuote" aria-label="Następny cytat">›</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Animacja cytatów */
.fade-slide-enter-active,
.fade-slide-leave-active { transition: opacity 400ms cubic-bezier(.2,.7,.2,1), transform 400ms cubic-bezier(.2,.7,.2,1); }
.fade-slide-enter-from { opacity: 0; transform: translateY(6px); }
.fade-slide-leave-to   { opacity: 0; transform: translateY(-6px); }
</style>