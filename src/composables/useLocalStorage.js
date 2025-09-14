export function saveLS(key, val) {
  try { localStorage.setItem('smartshop_'+key, JSON.stringify(val)) } catch {}
}
export function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem('smartshop_'+key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
