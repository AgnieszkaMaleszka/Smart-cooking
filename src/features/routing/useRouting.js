import { ref, reactive, computed, watch, nextTick } from 'vue'
import { saveLS, loadLS } from '../../composables/useLocalStorage.js'
import { orderShortest } from './strategies/shortest.js'
import { orderLight } from './strategies/light.js'
import { orderPriority } from './strategies/priority.js'
import { orderShortestNetwork } from './strategies/shortestNetwork.js'
import { getDistance } from './strategies/shared.js'
import { fetchRoute, profileFromMode } from './osrm.js'

export function useRouting({
  BRAND_LOGOS, DEFAULT_LOGO,
  findNearestShopForBrand,
  shopsWithLocation,
  selectedLists,
  centerRef,
  panTo,
}) {
  const objective = ref(loadLS('objective', 'shortest'))
  const mode = ref(loadLS('mode', 'walk')) // 'walk' | 'car'
  const modeIndex = computed(() => (mode.value === 'walk' ? 0 : 1))
  const selectedPriorities = ref(loadLS('selectedPriorities', []))

  const routeStart = ref(loadLS('routeStart', ''))
  const startSource = ref(loadLS('startSource', 'map'))
  const startLabel = computed(() => (startSource.value === 'geo' ? 'Moja lokalizacja' : 'Widok mapy'))

  const waypoints = ref([])
  const routeGeo = ref(null)
  const routeStats = reactive({ distance: 0, timeMin: 0, cost: 0, savings: 0 })
  const routeBuilding = ref(false)
  const liveMessage = ref('')

  let buildToken = 0

  function prettifyTag(name) {
    const n = String(name || '').toLowerCase()
    const m = n.match(/[a-ząćęłńóśźż%]+/gi)
    if (!m?.length) return ''
    const prefer = m.find(w => w.length >= 3) || m[0]
    return prefer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('%', '%')
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1) }
  const priorityTags = computed(() => {
    const tags = new Map()
    selectedLists.value.forEach(l => {
      (l.items || []).filter(i => i.promo).forEach(i => {
        const label = prettifyTag(i.name)
        if (label) tags.set(label.toLowerCase(), capitalize(label))
      })
    })
    const arr = Array.from(tags.values())
    const fallback = ['Masło','Kawa','Mleko','Jajka','Chleb','Szynka','Ser','Makaron','Ryż','Olej']
    return (arr.length ? arr : fallback).slice(0, 14)
  })
  function setObjective(o) {
    const allowed = ['shortest','light','priority']
    objective.value = allowed.includes(o) ? o : 'shortest'
  }
  function togglePriority(tag) {
    const i = selectedPriorities.value.indexOf(tag)
    if (i >= 0) selectedPriorities.value.splice(i,1)
    else selectedPriorities.value.push(tag)
  }

  function getStartLatLng() {
    if (routeStart.value && routeStart.value.includes(',')) {
      const [la, lo] = routeStart.value.split(',').map(v => parseFloat(v))
      return { lat: la, lng: lo }
    }
    return centerRef.value
  }
  function parsePriority() { return selectedPriorities.value.map(t => t.toLowerCase()) }
  function sumPrice(list) { return (list.items||[]).reduce((s,i)=> s + ((i.estPrice||0)*(i.qty||1)), 0) }
  function sumWeight(list) { return (list.items||[]).reduce((s,i)=> s + ((i.weight||0)*(i.qty||1)), 0) }
  function savingsPotential(list) {
    return (list.items||[]).reduce((acc,i)=> acc + (i.promo ? (i.estPrice||0)*0.15*(i.qty||1) : 0), 0)
  }

  function shopKey(shop) {
    if (!shop) return ''
    const id = shop.id != null ? String(shop.id) : ''
    if (id) return id
    const lat = Number(shop.lat).toFixed(5)
    const lng = Number(shop.lng).toFixed(5)
    return `${shop.shopName || shop.name || 'shop'}:${lat},${lng}`
  }

  async function buildWaypointsFromLists() {
    const start = getStartLatLng()
    const priorities = parsePriority()
    const tmp = []

    for (const l of selectedLists.value) {
      let shop = shopsWithLocation.value.find(s => s.shopName === l.storeName)
      if (!shop) shop = await findNearestShopForBrand({ brandName: l.storeName, center: start })
      if (!shop) continue

      const cost = sumPrice(l)
      const weight = sumWeight(l)
      const hasPriority = priorities.length
        ? (l.items||[]).some(i => priorities.some(p => String(i.name||'').toLowerCase().includes(p)))
        : false

      const key = shopKey(shop)
      tmp.push({
        listId: l.id,
        id: key, shopId: key,
        storeName: l.storeName,
        lat: shop.lat, lng: shop.lng,
        logoUrl: BRAND_LOGOS[l.storeName] || DEFAULT_LOGO,
        distanceFromStart: getDistance(start.lat, start.lng, shop.lat, shop.lng),
        cost, weight, hasPriority,
        savings: savingsPotential(l)
      })
    }

    const by = new Map()
    for (const w of tmp) {
      if (!by.has(w.shopId)) {
        by.set(w.shopId, { ...w, mergedListIds: [w.listId] })
      } else {
        const acc = by.get(w.shopId)
        acc.cost     += w.cost
        acc.weight   += w.weight
        acc.savings  += w.savings
        acc.hasPriority = acc.hasPriority || w.hasPriority
        acc.mergedListIds.push(w.listId)
      }
    }
    return Array.from(by.values())
  }

  async function orderWaypointsAsync(wps) {
    const start = getStartLatLng()
    if (wps.length <= 1) return wps
    if (objective.value === 'priority') return orderPriority(wps, start)
    if (objective.value === 'light')    return orderLight(wps, start, mode.value)
    if (mode.value === 'car') return await orderShortestNetwork(wps, start, { mode: 'car' })
    return orderShortest(wps, start)
  }

  function computeMetricsFallback(order) {
    const start = getStartLatLng()
    let prev = start, distance = 0
    for (const p of order) {
      distance += getDistance(prev.lat, prev.lng, p.lat, p.lng)
      prev = { lat: p.lat, lng: p.lng }
    }
    const speeds = { walk: 4.7, car: 35 }
    const kmh = speeds[mode.value] || 25
    const timeMin = (distance/1000) / kmh * 60
    const cost = selectedLists.value.reduce((s,l)=> s + sumPrice(l), 0)
    const savings = selectedLists.value.reduce((s,l)=> s + savingsPotential(l), 0)
    return { distance, timeMin, cost, savings }
  }

  async function buildRoute() {
    const myToken = ++buildToken
    try {
      routeBuilding.value = true
      liveMessage.value = 'Buduję trasę…'
      await nextTick()

      const wps = await buildWaypointsFromLists()
      const ordered = await orderWaypointsAsync(wps)
      if (myToken !== buildToken) return
      waypoints.value = ordered

      if (!ordered.length) {
        routeGeo.value = null
        Object.assign(routeStats, { distance:0, timeMin:0, cost:0, savings:0 })
        liveMessage.value = 'Brak punktów do trasy.'
        return
      }

      // ⬇️ KLUCZ: pierwszy punkt to ZAWSZE start (Twoja lokalizacja albo centrum mapy)
      const startPoint = getStartLatLng()
      const pointsForOsrm = [ startPoint, ...ordered ]

      let osrm = null
      try {
        osrm = await fetchRoute(pointsForOsrm, profileFromMode(mode.value), { overview: 'full' })
      } catch (e) {
        console.warn('[OSRM /route] fallback:', e)
      }
      if (myToken !== buildToken) return

      if (osrm?.geojson) {
        routeGeo.value = osrm.geojson
        const cost = selectedLists.value.reduce((s,l)=> s + sumPrice(l), 0)
        const savings = selectedLists.value.reduce((s,l)=> s + savingsPotential(l), 0)
        Object.assign(routeStats, {
          distance: osrm.distance,
          timeMin: osrm.duration / 60,
          cost, savings
        })
      } else {
        routeGeo.value = {
          type: 'LineString',
          coordinates: [
            [startPoint.lng, startPoint.lat],
            ...ordered.map(p => [p.lng, p.lat])
          ]
        }
        Object.assign(routeStats, computeMetricsFallback(ordered))
      }

      liveMessage.value = 'Trasa gotowa.'
    } finally {
      await new Promise(r => setTimeout(r, 180))
      if (myToken === buildToken) routeBuilding.value = false
    }
  }


  const stepDistances = computed(() => {
    const steps = []
    const start = getStartLatLng()
    let prev = start
    for (const w of waypoints.value) {
      steps.push(getDistance(prev.lat, prev.lng, w.lat, w.lng))
      prev = { lat: w.lat, lng: w.lng }
    }
    return steps // FIX: wcześniej było .slice(1)
  })

  watch([objective, mode, selectedPriorities, startSource], () => {
    saveLS('objective', objective.value)
    saveLS('mode', mode.value)
    saveLS('selectedPriorities', selectedPriorities.value)
    saveLS('startSource', startSource.value)
    if (selectedLists.value.length) buildRoute()
  })
  watch([shopsWithLocation, routeStart, selectedLists], () => {
    if (selectedLists.value.length) buildRoute()
  })

  function clearRoute() {
    waypoints.value = []
    routeGeo.value = null
    Object.assign(routeStats, { distance:0, timeMin:0, cost:0, savings:0 })
    liveMessage.value = 'Trasę wyczyszczono.'
  }

  function setStartFromGeo(lat, lng) {
    routeStart.value = `${lat},${lng}`
    startSource.value = 'geo'
    saveLS('routeStart', routeStart.value)
    saveLS('startSource', startSource.value)
  }

  return {
    objective, mode, modeIndex, selectedPriorities,
    routeStart, startSource, startLabel,
    setObjective, priorityTags, togglePriority,
    waypoints, routeGeo, routeStats, routeBuilding, liveMessage, stepDistances,
    buildRoute, clearRoute, setStartFromGeo,
  }
}
