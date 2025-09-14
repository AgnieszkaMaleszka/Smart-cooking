// src/features/lists/useShoppingLists.js
import { ref, computed } from 'vue'
import { loadAllUserLists } from '../../services/userLists.js'
import { saveLS, loadLS } from '../../composables/useLocalStorage.js'

/* ====================== helpers: id ====================== */
function idSuffix(v) {
  const s = String(v ?? '')
  const m = s.match(/(\d{3,})$/)
  return m ? m[1] : s.split(':').pop()
}
function idsEqual(a, b) {
  const sa = idSuffix(a), sb = idSuffix(b)
  return sa && sb ? sa === sb : String(a) === String(b)
}

/* ====================== helpers: parse/number ====================== */
function safeParseJSON(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}
function normalizeNumber(v, def = 0) {
  if (v == null || v === '') return def
  const n = Number(String(v).toString().replace(',', '.'))
  return Number.isFinite(n) ? n : def
}

/* ====================== weights from flyerSelections ====================== */
/** Dokleja wagi/ilości do itemów na podstawie oryginalnych wyborów */
function attachWeightsFromSelections(list) {
  const suffix = String(list.id).split(/[:\-]/).pop()
  const raw = localStorage.getItem('flyerSelections:' + suffix)
  const selections = safeParseJSON(raw, [])
  if (!Array.isArray(selections) || !selections.length || !Array.isArray(list.items)) return

  const byId = new Map(selections.filter(s => s?.id != null).map(s => [String(s.id), s]))

  list.items.forEach(it => {
    // dopasuj po id, a jak brak — spróbuj po name (case-insensitive)
    let src = byId.get(String(it.id))
    if (!src && it?.name) {
      const nameLower = String(it.name).toLowerCase()
      src = selections.find(s => String(s?.name || '').toLowerCase() === nameLower)
    }
    if (!src) return
    if (src.weight !== undefined) it.weight = normalizeNumber(src.weight, it.weight ?? 0)
    if (src.qty !== undefined)    it.qty    = normalizeNumber(src.qty,    it.qty ?? 1) || 1
    if (src.unit)                 it.unit   = src.unit
  })
}

/* ====================== purge cache by suffixes ====================== */
function purgeUserListsCacheBySuffixes(sfxSet) {
  // wersja defensywna: usuń z naszego snapshotu list (jeśli istnieje)
  try {
    const raw = localStorage.getItem('smartshop_user_lists')
    if (raw) {
      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        const filtered = data.filter(entry => !sfxSet.has(idSuffix(entry?.id)))
        localStorage.setItem('smartshop_user_lists', JSON.stringify(filtered))
      }
    }
  } catch {}
}

/* ====================== item normalization ====================== */
function normalizeItem(raw, idx, fallbackThumb) {
  const id = String(raw?.id ?? raw?.sku ?? raw?.code ?? `item-${idx}`)
  const name = raw?.name || raw?.title || 'Produkt'
  const qty = normalizeNumber(raw?.qty, 1) || 1
  const unit = raw?.unit || 'szt.'
  const weight = normalizeNumber(raw?.weight, 0)
  const estPrice = normalizeNumber(raw?.estPrice ?? raw?.price, 0)
  const promo = Boolean(raw?.promo || raw?.isPromo || raw?.onSale)
  const bought = Boolean(raw?.bought)
  const thumbnail = raw?.thumbnail || fallbackThumb || null
  return { id, name, qty, unit, weight, estPrice, promo, bought, thumbnail }
}

/* ====================== main composable ====================== */
export function useShoppingLists({ logosMap, defaultLogo }) {
  const listsLoading = ref(false)
  const lists = ref([])
  const listsFilter = ref('')
  const selectedListIds = ref(loadLS('selectedListIds', []))

  // blokada reentrancyjna — nie uruchamiaj wielu refreshów naraz
  let refreshInFlight = null

  const filteredLists = computed(() => {
    const src = lists.value || []
    const q = (listsFilter.value || '').toLowerCase().trim()
    if (!q) return src
    return src.filter(l => {
      const store = (l.storeName || '').toLowerCase()
      const items = Array.isArray(l.items) ? l.items : []
      return store.includes(q) || items.some(i => (i?.name || '').toLowerCase().includes(q))
    })
  })

  const selectedLists = computed(() => (lists.value || []).filter(l => isSelected(l.id)))
  function isSelected(id) { return selectedListIds.value.some(x => idsEqual(x, id)) }

  function toggleList(id) {
    if (isSelected(id)) {
      selectedListIds.value = selectedListIds.value.filter(x => !idsEqual(x, id))
    } else {
      selectedListIds.value = [...selectedListIds.value, id]
    }
    saveLS('selectedListIds', selectedListIds.value)
  }

  const allVisibleSelected = computed(() =>
    filteredLists.value.length > 0 &&
    filteredLists.value.every(l => isSelected(l.id))
  )

  function toggleSelectAll() {
    if (allVisibleSelected.value) {
      const visibleIds = new Set(filteredLists.value.map(l => idSuffix(l.id)))
      selectedListIds.value = selectedListIds.value.filter(id => !visibleIds.has(idSuffix(id)))
    } else {
      const ids = new Map(selectedListIds.value.map(v => [idSuffix(v), v]))
      filteredLists.value.forEach(l => ids.set(idSuffix(l.id), l.id))
      selectedListIds.value = Array.from(ids.values())
    }
    saveLS('selectedListIds', selectedListIds.value)
  }

  function sumPrice(list)  {
    const items = Array.isArray(list?.items) ? list.items : []
    return items.reduce((s,i)=> s + (normalizeNumber(i.estPrice, 0) * normalizeNumber(i.qty, 1)), 0)
  }
  function sumWeight(list) {
    const items = Array.isArray(list?.items) ? list.items : []
    return items.reduce((s,i)=> s + (normalizeNumber(i.weight, 0) * normalizeNumber(i.qty, 1)), 0)
  }
  function savingsPotential(list) {
    const items = Array.isArray(list?.items) ? list.items : []
    return items.reduce((acc,i)=> acc + (i.promo ? normalizeNumber(i.estPrice, 0) * 0.15 * normalizeNumber(i.qty, 1) : 0), 0)
  }

  async function refreshUserLists() {
    if (refreshInFlight) return refreshInFlight
    listsLoading.value = true

    refreshInFlight = (async () => {
      try {
        // 1) pobierz surowe listy
        const loadedRaw = await loadAllUserLists({ thumbMaxSide: 200 })
        const loaded = Array.isArray(loadedRaw) ? loadedRaw.slice() : []

        // 2) sortuj po dacie malejąco
        loaded.sort((a,b)=> new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())

        // 3) doprowadź każdą listę do spójnego kształtu
        loaded.forEach(l => {
          // sklep/etykieta
          l.storeName = l.storeName || l.shopName || 'Gazetka'
          l.logoUrl = (logosMap?.[l.storeName] || l.logoUrl || defaultLogo)

          // pozycje — normalizacja kształtu
          const itemsSrc = Array.isArray(l.items) ? l.items : []
          l.items = itemsSrc.map((it, idx) => normalizeItem(it, idx, l.logoUrl))

          // unikalne ID pozycji (na wszelki wypadek)
          const seen = new Set()
          l.items = l.items.map((it, idx) => {
            let newid = String(it.id)
            if (seen.has(newid)) newid = `${newid}-${idx}`
            seen.add(newid)
            return { ...it, id: newid }
          })

          // dociągnij wagi/ilości z flyerSelections
          attachWeightsFromSelections(l)
        })

        // 4) ustaw listy
        lists.value = loaded

        // 5) sanity-check selekcji: usuń zaznaczenia dla nieistniejących list
        const knownSfx = new Set(loaded.map(l => idSuffix(l.id)))
        selectedListIds.value = selectedListIds.value.filter(id => knownSfx.has(idSuffix(id)))
        saveLS('selectedListIds', selectedListIds.value)
      } catch (e) {
        console.error('Nie udało się wczytać list użytkownika', e)
        lists.value = []
      } finally {
        listsLoading.value = false
        refreshInFlight = null
      }
    })()

    return refreshInFlight
  }

  async function deleteLists(targets) {
    if (!Array.isArray(targets) || !targets.length) return false
    const sfxSet = new Set(targets.map(t => idSuffix(t?.id)).filter(Boolean))

    // snapshot wszystkich kluczy LS
    const allKeys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) allKeys.push(k)
    }

    const prefixes = ['flyerSelections:', 'flyerPages:', 'flyerMeta:', 'flyerShop:', 'flyerThumbs:']
    const toRemoveKeys = new Set()

    // klucze osadzone w obiekcie listy
    for (const t of targets) {
      if (t?.storageKey) toRemoveKeys.add(String(t.storageKey))
      if (t?.sourceKey)  toRemoveKeys.add(String(t.sourceKey))
    }
    // standardowe prefixy
    for (const sfx of sfxSet) prefixes.forEach(p => toRemoveKeys.add(p + sfx))
    // defensywnie: dowolne flyer* zawierające sufiks
    for (const k of allKeys) {
      if (!/^flyer/i.test(k)) continue
      for (const sfx of sfxSet) {
        if (k.endsWith(':'+sfx) || k.includes(':'+sfx) || k.includes(sfx)) toRemoveKeys.add(k)
      }
    }

    let removed = 0
    for (const k of toRemoveKeys) {
      if (localStorage.getItem(k) !== null) {
        try { localStorage.removeItem(k); removed++ } catch {}
      }
    }

    purgeUserListsCacheBySuffixes(sfxSet)

    // oczyść selekcje
    selectedListIds.value = selectedListIds.value.filter(id => !sfxSet.has(idSuffix(id)))
    saveLS('selectedListIds', selectedListIds.value)

    await refreshUserLists()
    return removed > 0
  }

  async function deleteListsByIds(ids) {
    const sfxWanted = new Set((ids || []).map(idSuffix))
    const targets = (lists.value || []).filter(l => sfxWanted.has(idSuffix(l.id)))
    return deleteLists(targets)
  }

  return {
    // state
    listsLoading, lists, listsFilter, filteredLists,
    selectedListIds, selectedLists, allVisibleSelected,
    // actions
    refreshUserLists, toggleList, toggleSelectAll,
    deleteLists, deleteListsByIds,
    // helpers
    isSelected, idSuffix, idsEqual, sumPrice, sumWeight, savingsPotential,
  }
}
