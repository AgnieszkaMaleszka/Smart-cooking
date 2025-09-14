// src/composables/useShoppingLists.js  ← UPROSZCZONE: BEZ CANVASA, BEZ PROXY
import { ref } from 'vue'
import { readFlyerContext } from '@/utils/flyerContext'

export function useShoppingLists({ apiBase } = {}) {
  const lists = ref([])

  async function loadLists(options = {}) {
    // 1) API (jeśli masz backend — inaczej pominie)
    if (apiBase) {
      try {
        const r = await fetch(`${apiBase}/lists`, { credentials: 'include' })
        if (r.ok) {
          const data = await r.json()
          lists.value = normalizeLists(data)
          persist()
          return
        }
      } catch { /* noop */ }
    }

    // 2) Kanoniczny LS
    const fromLS = readLS(LS_KEY)
    if (Array.isArray(fromLS) && fromLS.length) {
      lists.value = normalizeLists(fromLS)
      persist()
      return
    }

    // 3) MIGRACJA z flyerSelections:*  → MINIATURA = PEŁNA STRONA (bez cropa i bez canva)
    const migrated = migrateFromFlyerSelectionsSimple()
    if (migrated.length) {
      lists.value = normalizeLists(migrated)
      persist()
      return
    }

    lists.value = []
    persist()
  }

  function migrateFromFlyerSelectionsSimple() {
    const result = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('flyerSelections:')) continue

      const flyerId = key.split(':')[1]
      let selections = []
      try {
        const raw = localStorage.getItem(key)
        selections = JSON.parse(raw) || []
      } catch { /* ignore */ }
      if (!selections.length) continue

      const ctx = readFlyerContext(flyerId) // { pages, meta }
      const storeName = ctx.meta?.shopName || ctx.meta?.storeName || 'Gazetka'
      const logoUrl = ctx.meta?.logo || ctx.meta?.logoUrl || getGazetkaLogo()

      const createdTs = selections
        .map(s => Number(s.at))
        .filter(n => !isNaN(n))
        .sort((a,b)=>a-b)[0] || Date.now()

      const items = selections.map(sel => ({
        id: String(sel.id || cryptoRandom()),
        name: (sel.title || '').trim() || 'Produkt z gazetki',
        qty: 1,
        unit: 'szt',
        estPrice: parsePrice(sel.price) ?? 0,
        promo: true,
        weight: 0,
        // ⬇️ ZAMIENIAMY NA PROSTE MINIATURY: PEŁNA STRONA (BEZ CROP, BEZ CORS)
        thumbnail: Array.isArray(ctx.pages) && ctx.pages[sel.page] ? ctx.pages[sel.page] : (logoUrl || getGazetkaLogo()),
        bought: !!sel.done
      }))

      result.push({
        id: `flyer:${flyerId}`,
        storeName,
        logoUrl: logoUrl || getGazetkaLogo(),
        createdAt: new Date(createdTs).toISOString(),
        items
      })
    }

    // najnowsze na górze
    result.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    return result
  }

  function normalizeLists(arr) {
    return (arr || []).map(l => ({
      id: String(l.id ?? cryptoRandom()),
      storeName: String(l.storeName ?? 'Sklep'),
      logoUrl: l.logoUrl || null,
      createdAt: l.createdAt || new Date().toISOString(),
      items: Array.isArray(l.items) ? l.items.map(i => ({
        id: String(i.id ?? cryptoRandom()),
        name: String(i.name ?? 'Produkt'),
        qty: Number(i.qty ?? 1),
        unit: String(i.unit ?? 'szt'),
        estPrice: Number(i.estPrice ?? 0),
        promo: !!i.promo,
        weight: Number(i.weight ?? 0),
        thumbnail: i.thumbnail || null,
        bought: !!i.bought
      })) : []
    }))
  }

  function toggleItemBought(listId, itemId, val) {
    const l = lists.value.find(l => l.id === listId)
    if (!l) return
    const it = l.items.find(i => i.id === itemId)
    if (!it) return
    it.bought = !!val
    persist()
  }

  function upsertList(payload) {
    const l = normalizeLists([payload])[0]
    const idx = lists.value.findIndex(x => x.id === l.id)
    if (idx >= 0) lists.value[idx] = l
    else lists.value.unshift(l)
    persist()
  }

  function removeList(id) {
    lists.value = lists.value.filter(l => l.id !== id)
    persist()
  }

  function sumPrice(list) { return (list.items || []).reduce((s,i)=> s + (Number(i.estPrice || 0) * Number(i.qty || 1)), 0) }
  function sumWeight(list) { return (list.items || []).reduce((s,i)=> s + (Number(i.weight || 0) * Number(i.qty || 1)), 0) }

  // helpers
  const LS_KEY = 'smartshop_user_lists'
  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(lists.value)) } catch {} }
  function readLS(k) { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null } catch { return null } }
  function parsePrice(txt) {
    if (!txt) return null
    const s = String(txt).replace(/\s+/g, '').replace(/[zł€$]/gi, '').replace(',', '.')
    const m = s.match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : null
  }
  function cryptoRandom() { return (crypto?.randomUUID?.() || ('id-' + Math.random().toString(36).slice(2, 10))) }
  function getGazetkaLogo() {
    try { return new URL('../assets/newspaper-solid-full-background.png', import.meta.url).href }
    catch { return '' }
  }

  // dev
  if (typeof window !== 'undefined') {
    window.smartshop_dumpLists = () => JSON.parse(JSON.stringify(lists.value))
  }

  return { lists, loadLists, toggleItemBought, upsertList, removeList, sumPrice, sumWeight }
}
