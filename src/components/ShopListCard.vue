<template>
  <li class="shop-card" :class="{ 'shop-card--selected': modelValue }">
    <label class="shop-card__select">
      <input type="checkbox" :checked="modelValue" @change="$emit('update:modelValue', $event.target.checked)" />
      <span class="shop-card__title">{{ list.storeName }}</span>
      <time class="shop-card__date" :datetime="list.createdAt">{{ formatDate(list.createdAt) }}</time>
    </label>

    <ul class="items">
      <li v-for="item in list.items" :key="item.id" class="item">
        <label class="item__row">
          <input type="checkbox" v-model="item.checked" @change="$emit('item-check', list.id, item)" :aria-label="'Odhacz ' + item.name" />
          <img :src="item.thumb" alt="" class="item__thumb" />
          <div class="item__meta">
            <strong class="item__name">{{ item.name }}</strong>
            <small class="item__desc">{{ item.desc }}</small>
          </div>
          <div class="item__price"><span>{{ currency(item.price) }}</span></div>
        </label>
      </li>
    </ul>

    <footer class="shop-card__footer">
      <div class="shop-card__stats">
        <span>{{ list.items.length }} prod.</span>
        <span>~ {{ currency(total) }}</span>
      </div>
      <button class="btn btn-ghost btn--sm" @click="$emit('focus', list)">Pokaż na mapie</button>
    </footer>
  </li>
</template>

<script>
export default {
  name: 'ShopListCard',
  props: {
    list: { type: Object, required: true },
    modelValue: { type: Boolean, default: false },
  },
  computed: {
    total(){ return this.list.items.reduce((s, it) => s + it.price, 0) },
  },
  methods: {
    currency(v){ return new Intl.NumberFormat('pl-PL', { style:'currency', currency:'PLN' }).format(v) },
    formatDate(iso){ const d = new Date(iso); return d.toLocaleDateString('pl-PL', { year:'numeric', month:'short', day:'2-digit' }) },
  }
}
</script>

<style scoped>
/* skopiuj bloki styli .shop-card* oraz .items .item* z widoku */
</style>
