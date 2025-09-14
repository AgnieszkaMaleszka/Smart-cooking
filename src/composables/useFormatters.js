// Wspólne formatery – 1 miejsce dla formatów
export function formatKm(m) { return `${(m/1000).toFixed(1)} km` }
export function formatMinutes(min) {
  const v = Math.round(min)
  return v >= 60 ? `${Math.floor(v/60)} h ${v%60} min` : `${v} min`
}
export function formatPrice(v) { return `${(v||0).toFixed(2).replace('.', ',')} zł` }
export function formatDate(iso) { try { return new Date(iso).toLocaleDateString('pl-PL') } catch { return iso } }
export function formatWeight(w) {
  const v = Number(w) || 0
  if (!v) return ''
  if (v >= 1000) {
    const kg = v / 1000
    const pretty = (kg % 1 === 0) ? kg.toFixed(0) : kg.toFixed(1)
    return `${pretty} kg`
  }
  return `${v} g`
}
