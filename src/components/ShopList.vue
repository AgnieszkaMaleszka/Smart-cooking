<template>
  <div class="shop-list">
    <div class="shop-list__header">Lista sklepów</div>

    <!-- LOADING STATE -->
    <div v-if="loading" class="shop-list__loading">
      <div class="loader">
        <span class="spinner" aria-hidden="true"></span>
        <span>Wyszukuję sklepy w okolicy…</span>
      </div>

      <!-- skeletony wierszy -->
      <ul class="shop-list__items">
        <li v-for="n in 4" :key="n" class="shop-item skeleton">
          <div class="shop-item__logo"></div>
          <div class="shop-item__info">
            <div class="skeleton-bar w-70"></div>
            <div class="skeleton-bar w-40"></div>
          </div>
          <div class="shop-item__dist">
            <div class="skeleton-bar w-30"></div>
          </div>
        </li>
      </ul>
    </div>

    <!-- DATA -->
    <template v-else>
      <div class="shop-list__caption" v-if="shops.length || totalFound">
        Znalezione sklepy w okolicy ({{ shops.length }} z {{ totalFound }}):
      </div>

      <ul class="shop-list__items" v-if="shops.length">
        <li
          v-for="s in shops"
          :key="s.shopName + s.lat + s.lng"
          class="shop-item"
          @click="$emit('focus', s)"
        >
          <img
            v-if="s.logoUrl"
            :src="s.logoUrl"
            :alt="s.shopName"
            class="shop-item__logo"
            loading="lazy"
            width="32"
            height="32"
          />
          <div v-else class="shop-item__logo placeholder">{{ (s.shopName || '?').slice(0,1) }}</div>

          <div class="shop-item__info">
            <div class="shop-item__name">{{ s.shopName }}</div>
            <div class="shop-item__addr">{{ s.address || 'brak adresu' }}</div>
          </div>

          <div class="shop-item__dist">{{ formatMeters(s.distance) }}</div>
        </li>
      </ul>

      <div v-else class="shop-list__empty">Brak sklepów w tej okolicy.</div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  shops: { type: Array, required: true },
  totalFound: { type: Number, default: 0 },
  formatMeters: { type: Function, required: true },
  loading: { type: Boolean, default: false }
})
defineEmits(['focus'])
</script>

<style scoped>
.shop-list {
  border-top: 1px solid rgba(10, 64, 12, 0.12);
  background: linear-gradient(0deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)), var(--color-paper);
  padding: 10px 12px 14px;
}

.shop-list__header {
  font-weight: 700;
  color: var(--color-ink);
  font-family: var(--font-head);
  font-size: 20px;
  letter-spacing: 0.2px;
  user-select: none;
  margin-bottom: 4px;
}

.shop-list__caption {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-paper);
  font-weight: 600;
  font-size: 13px;
  color: rgba(10, 64, 12, 0.78);
  padding: 6px 0;
  border-bottom: 1px solid rgba(10, 64, 12, 0.08);
  margin: 0 0 8px;
}

.shop-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 260px;
  overflow: auto;
}

.shop-item {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: var(--radius-lg);
  background: #fff;
  border: 1px solid rgba(10, 64, 12, 0.12);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
  transition: transform var(--transition-1), box-shadow var(--transition-1), background-color var(--transition-1), border-color var(--transition-1);
}

.shop-item + .shop-item {
  margin-top: 6px;
}

.shop-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 22px rgba(10, 64, 12, 0.12);
  background: rgba(246, 243, 233, 0.35);
}

.shop-item:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.shop-item__logo {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
  border: 1px solid rgba(10, 64, 12, 0.12);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--color-ink);
}

.shop-item__logo.placeholder {
  background: #f5f7f4;
  font-family: var(--font-head);
  font-size: 18px;
}

.shop-item__info {
  min-width: 0;
}

.shop-item__name {
  font-family: var(--font-head);
  font-weight: 700;
  color: var(--color-ink);
  line-height: 1.2;
}

.shop-item__addr {
  font-family: var(--font-body);
  color: rgba(10, 64, 12, 0.72);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-item__dist {
  font-family: var(--font-head);
  margin-left: 6px;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/* Loading */
.shop-list__loading .loader {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px 10px;
  color: var(--color-ink);
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-body);
}

.spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(10, 64, 12, 0.2);
  border-top-color: var(--color-ink);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Skeletons */
.skeleton {
  cursor: default;
}

.skeleton .shop-item__logo {
  background: #f3f4f6;
  border-color: rgba(10, 64, 12, 0.12);
}

.skeleton-bar {
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
  margin: 6px 0 0;
}

.w-70 {
  width: 70%;
}

.w-40 {
  width: 40%;
}

.w-30 {
  width: 56px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.shop-list__empty {
  color: rgba(10, 64, 12, 0.72);
  font-family: var(--font-body);
  font-size: 14px;
  padding: 8px 2px;
}

/* Scrollbar (dopasowanie do stylu) */
.shop-list__items::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}

.shop-list__items::-webkit-scrollbar-thumb {
  background: rgba(10, 64, 12, 0.18);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
</style>
