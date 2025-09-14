<script setup>
import bgUrl from './assets/background.jpg'
</script>

<template>
  <a class="skip-link" href="#main">Pomiń do treści</a>

  <div class="header-actions">
    <router-link to="/shopping-list" class="action-wrapper" title="Lista zakupów">
      <div class="action-icon-frame" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="#0A400C" viewBox="0 0 24 24" role="img" aria-label="Lista do odhaczenia">
          <path d="M3 5h18v2H3V5zm0 6h10v2H3v-2zm0 6h6v2H3v-2zm14.59-5.41L18 13.17l4.59-4.58L24 10l-6 6-3.41-3.41z"/>
        </svg>
      </div>
    </router-link>

    <router-link to="/account" class="action-wrapper" title="Moje konto">
      <div class="action-icon-frame" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="#0A400C" viewBox="0 0 24 24" role="img" aria-label="Ikona konta">
          <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
        </svg>
      </div>
      <span class="action-text">Moje konto</span>
    </router-link>
  </div>

  <div class="bg" :style="{ '--bg-url': `url(${bgUrl})` }" aria-hidden="true"></div>

  <main id="main" class="page" role="main" aria-label="Główna treść">
    <router-view />
  </main>

  <footer class="app-footer">
    <p>&copy; 2025 Smart Cooking. Wszelkie prawa zastrzeżone.</p>
  </footer>
</template>

<style scoped>
/* Reszta stylów bez zmian... */
.skip-link {
  position: fixed;
  left: 8px;
  top: 8px;
  z-index: 9999;
  background: #fff;
  color: var(--color-ink);
  padding: 8px 12px;
  border-radius: var(--radius-round);
  border: 1px solid rgba(10,64,12,.2);
  transform: translateY(-150%);
  transition: transform var(--transition-1);
}
.skip-link:focus {
  transform: translateY(0);
  outline: 2px solid var(--role-info);
}

/* Nowe style dla kontenera i kapsułek */
.header-actions {
  position: fixed;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px; /* Odstęp między kapsułkami */
  z-index: 99; /* Upewnij się, że jest na wierzchu */
}

/* Ogólne style dla kapsułek (zamiast .account-wrapper) */
.action-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: #fff;
  padding: 8px 12px;
  border-radius: var(--radius-round);
  text-decoration: none;
  color: var(--color-ink);
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
  border: 1px solid rgba(10,64,12,.2);
  transition: transform var(--transition-1), box-shadow var(--transition-1);
}

.action-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,.1);
}

.action-icon-frame {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon-frame svg {
  width: 100%;
  height: 100%;
}

.action-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

/* Oddychające tło */
.bg {
  position: fixed;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(1000px 700px at 65% -10%, rgba(160, 176, 138, 0.14), transparent 60%),
    linear-gradient(0deg, rgba(246, 243, 233, 0.35), rgba(246, 243, 233, 0.35)),
    var(--bg-url);
  background-size: auto, auto, cover;
  background-position: center;
  background-repeat: no-repeat;
  background-blend-mode: multiply, lighten, normal;
  filter: saturate(0.96) contrast(0.98) brightness(0.985);
  animation: zoomBg 12s ease-in-out infinite alternate;
  will-change: transform;
}
@keyframes zoomBg {
  0%   { transform: scale(1) translateY(0); }
  100% { transform: scale(1.045) translateY(-1%); }
}
@media (prefers-reduced-motion: reduce) { .bg { animation: none; } }
</style>