<template>
  <article
    class="list-card receipt"
    :class="{ 'is-selected': selected }"
    :aria-pressed="selected"
    role="button"
    tabindex="0"
    @click="$emit('toggle')"
    @keyup.enter.prevent="$emit('toggle')"
    @keyup.space.prevent="$emit('toggle')"
  >
    <!-- lewy „rail” selekcji -->
    <span v-if="selected" class="select-rail" aria-hidden="true"></span>

    <header class="list-card__header">
      <div class="list-card__title" @click.stop>
        <div class="logo-wrap">
          <img :src="logoForStore" :alt="list.storeName" width="28" height="28" />
          <span v-if="selected" class="logo-check" aria-hidden="true">✓</span>
        </div>
        <div class="title-text">
          <strong class="store-name">{{ list.storeName }}</strong>
          <div class="muted small">Utworzono: {{ formatDate(list.createdAt) }}</div>
        </div>
      </div>

      <!-- KOSZ: nowy, idealnie wycentrowany, czyste proporcje -->
      <button
        class="list-card__delete"
        title="Usuń tę listę"
        aria-label="Usuń tę listę"
        @click.stop="$emit('request-delete')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <!-- pokrywa -->
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <!-- linia przy górze -->
          <path d="M3 6h18" />
          <!-- kubeł -->
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <!-- pręty -->
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </header>

    <div class="list-card__body" @click.stop>
      <ul class="item-list">
        <li
          v-for="item in (list.items || []).slice(0,5)"
          :key="item.id"
          :class="['item', { 'is-bought': item.bought }]"
        >
          <img
            :src="item.thumbnail || logoForStore"
            :alt="item.name"
            width="40"
            height="40"
            class="item__thumb"
          />
          <div class="item__meta">
            <div class="item__title">
              <span class="name" :title="item.name">{{ item.name }}</span>
              <span v-if="item.qty" class="muted">
                · {{ item.qty }} {{ item.unit || 'szt.' }}
                <template v-if="Number(item.weight) > 0">
                  ({{ formatWeight(item.weight) }}/szt.
                  <template v-if="Number(item.qty) > 1">, razem {{ formatWeight(Number(item.weight) * Number(item.qty)) }}</template>)
                </template>
              </span>
              <span v-else-if="Number(item.weight) > 0" class="muted">· {{ formatWeight(item.weight) }}</span>
            </div>
            <div class="item__badges">
              <span v-if="item.promo" class="badge badge--deal" title="Promocja">Promo</span>
              <span class="badge badge--light" :title="`Szacowany koszt: ${formatPrice(item.estPrice)}`">
                {{ formatPrice(item.estPrice) }}
              </span>
            </div>
          </div>

          <!-- minimalistyczny checkbox, bez tekstu -->
          <label class="checkbox checkbox--ghost" :title="item.bought ? 'Oznacz jako niekupione' : 'Oznacz jako kupione'">
            <input type="checkbox" v-model="item.bought" aria-label="Kupione" />
          </label>
        </li>
      </ul>

      <div class="list-card__stats">
        <span>{{ (list.items || []).length }} pozycji</span>
        <span>~{{ ((totalWeight||0)/1000).toFixed(1) }} kg</span>
        <strong>{{ formatPrice(totalPrice||0) }}</strong>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  list: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  logosMap: { type: Object, required: true },
  defaultLogo: { type: String, required: true },

  formatPrice: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  formatWeight: { type: Function, required: true },

  totalWeight: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
})

defineEmits(['toggle','request-delete'])

const logoForStore = computed(() =>
  props.logosMap?.[props.list?.storeName] || props.list?.logoUrl || props.defaultLogo
)
</script>

<style scoped>
.list-card {
  position: relative; background: #fff;
  border:1px solid rgba(10,64,12,.12); border-radius: 14px;
  box-shadow: var(--shadow-soft);
  transition: box-shadow .18s, transform .18s, border-color .18s, background-color .18s;
  outline: none;
}
.list-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(10,64,12,.12); }
.list-card:focus-visible { box-shadow: 0 0 0 3px rgba(104,148,27,.28); }
.list-card.is-selected {
  background:
    radial-gradient(800px 200px at 50% -20px, rgba(104,148,27,.06), transparent),
    #fff;
  box-shadow: 0 14px 36px rgba(104,148,27,.16);
  transform: translateY(-1px);
}
.select-rail {
  position: absolute; left: 6px; top: 8px; bottom: 8px; width: 4px; border-radius: 6px;
  background: linear-gradient(180deg, #4caf50, #2e7d32);
  box-shadow: 0 0 0 1px rgba(46,125,50,.2), 0 4px 10px rgba(46,125,50,.25);
}

/* header */
.list-card__header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; background: transparent; border-bottom: none;
  border-top-left-radius: 14px; border-top-right-radius: 14px;
}
.list-card__title { display:flex; align-items:center; gap:12px; }
.store-name { font-size: 15px; }
.logo-wrap { position: relative; width: 28px; height: 28px; border-radius: 8px; overflow: visible; }
.logo-wrap img { display:block; width: 28px; height: 28px; border-radius: 6px; border:1px solid rgba(10,64,12,.12); background:#fff; }
.logo-check {
  position: absolute; right: -4px; bottom: -4px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #2e7d32; color:#fff; font-weight:900; font-size: 11px;
  display:grid; place-items:center; border:1px solid rgba(255,255,255,.9);
  box-shadow: 0 4px 10px rgba(46,125,50,.35);
}

/* NOWY KOSZ */
.list-card__delete {
  width: 28px; height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(10,64,12,.12);
  background: #fff; color: rgba(10,64,12,.8);
  display: grid; place-items: center;
  cursor: pointer;
  opacity: 0; transform: translateY(-2px);
  transition: opacity .18s, transform .18s, color .18s, border-color .18s, background-color .18s, box-shadow .18s;
  z-index: 3;
  line-height: 0; /* usuwa baseline, środek jest 1:1 */
}
.list-card:hover .list-card__delete,
.list-card:focus-within .list-card__delete { opacity: 1; transform: translateY(0); }
.list-card__delete:hover {
  color: #b91c1c; background: rgba(220,38,38,.06); border-color: rgba(220,38,38,.28);
  box-shadow: 0 4px 10px rgba(220,38,38,.12);
}
.list-card__delete svg {
  width: 18px; height: 18px; display:block;
  stroke: currentColor; fill: none; stroke-width: 1.75;
  stroke-linecap: round; stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
}

/* body + items */
.list-card__body { padding: 12px 14px; display: grid; gap:12px; }
.item-list { list-style:none; padding:0; margin:0; display:grid; gap:10px; }
.item { display:flex; align-items:center; gap:12px; transition: opacity .2s, transform .2s, filter .2s; }
.item__thumb {
  object-fit:cover; background:#fff; border:1px solid rgba(10,64,12,.1); border-radius:10px;
  transition: filter .2s ease, opacity .2s ease;
}
.item.is-bought { opacity:.72; }
.item.is-bought .item__thumb { filter: grayscale(1) brightness(.96); }
.item__meta { display:flex; flex-direction:column; gap:4px; min-width:0; }
.item__title { display:flex; align-items:center; gap:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.item__title .name { position: relative; }
.item.is-bought .item__title .name { text-decoration: line-through; text-decoration-thickness: 1.5px; }
.item__badges { display:flex; gap:6px; align-items:center; }
.badge { display:inline-flex; align-items:center; gap:4px; height:22px; padding:0 8px; border-radius:999px; font-weight:800; font-size:12px; }
.badge--deal { background: rgba(104,148,27,.18); color: var(--color-ink); border:1px solid rgba(104,148,27,.28); }
.badge--light { background: rgba(10,64,12,.06); color: var(--color-ink); }

/* checkbox minimalistyczny (bez tekstu), pokazujemy na hover/focus desktop */
.checkbox { display:flex; align-items:center; margin-left:auto; }
.checkbox input {
  width:18px; height:18px; border:1px solid rgba(10,64,12,.28); border-radius:4px; appearance:none;
  display:inline-block; position:relative; background:#fff; cursor:pointer; outline:none;
}
.checkbox input:checked::after { content:""; position:absolute; inset:3px; border-radius:2px; background: var(--color-ink); }
@media (hover: hover) {
  .checkbox { opacity: 0; transition: opacity .15s ease; }
  .item:hover .checkbox, .item:focus-within .checkbox { opacity: 1; }
}

.list-card__stats { display:flex; align-items:center; justify-content: space-between; color: var(--color-ink); }
</style>
