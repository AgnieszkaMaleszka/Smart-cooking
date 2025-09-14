export function toLocalImage(url) {
  try {
    if (!url) return ''
    if (typeof window === 'undefined') return url
    if (url.startsWith('data:')) return url
    if (url.startsWith('/imgblix/')) return url

    const u = new URL(url, window.location.origin)
    if (u.origin === window.location.origin) return u.pathname + (u.search || '')
    if (u.hostname === 'img.blix.pl') {
      return `/imgblix${u.pathname}${u.search || ''}`
    }
    return url
  } catch {
    return url || ''
  }
}

// alias do istniejących importów
export function proxifyImage(url) { return toLocalImage(url) }

// ⬇️ NOWE: zdejmujemy lokalny prefix i zwracamy oryginalny adres (np. do <img> w Lightboxie)
export function deproxifyImage(url) {
  if (!url) return ''
  try {
    // jeżeli to /imgblix/..., zrób z powrotem https://img.blix.pl/...
    if (url.startsWith('/imgblix/')) {
      return `https://img.blix.pl${url.slice('/imgblix'.length)}`
    }
    return url
  } catch { return url }
}

export default { toLocalImage, proxifyImage, deproxifyImage }