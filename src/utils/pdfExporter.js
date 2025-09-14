// src/utils/pdfExporter.js
// npm i jspdf
import { jsPDF } from 'jspdf'
import { proxifyImage } from '../utils/imageProxy'

/**
 * Eksport "Listy zakupów" do A4 PDF z dwukolumnowym, równym układem (bez notatek).
 * - Zero rozciągania obrazów: dopasowanie "cover" z centrowaniem
 * - Ostrość: miniatury renderujemy w 2× rozdzielczości i osadzamy jako JPEG
 * - Stabilny layout: 2 kolumny, powtarzalne "karty" o tej samej wysokości
 *
 * @param {Array} items   Array<{ title, price, page, rect, at, done }>
 * @param {Object} opts   { shopName?: string, address?: string, pages?: string[], filename?: string }
 */
export async function exportShoppingListPDF(items, opts = {}) {
  const {
    shopName = 'Sklep',
    address = '',
    pages = [],
    filename = `lista-zakupow-${(shopName || 'sklep').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.pdf`
  } = opts

  // A4 w mm
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })

  // ---- USTAWIENIA LAYOUTU ----
  const PAGE_W = 210
  const PAGE_H = 297
  const MARGIN = 14
  const GUTTER = 6
  const COL_W = (PAGE_W - MARGIN * 2 - GUTTER) / 2 // dwie kolumny

  // 🔽 Obrazki mniejsze: tylko połowa wysokości kolumny (~1:1 ratio)
  const IMG_H = Math.round(COL_W * 0.55) // było 0.75 → mniejsze
  const TITLE_FS = 10
  const PRICE_FS = 11
  const META_FS = 8
  const SPACING = 2

  // wysokość karty
  const CARD_TEXT_H = 5 /*title*/ + SPACING + 5 /*price*/ + SPACING + 4 /*meta*/ + 1
  const CARD_H = IMG_H + 4 /*padding*/ + CARD_TEXT_H

  // Y start po nagłówku
  let y = MARGIN + 18

  // ---- NAGŁÓWEK ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Lista zakupów', MARGIN, MARGIN + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const headerRight = new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
  doc.text(`${shopName}${address ? ' • ' + address : ''}`, MARGIN, MARGIN + 12)
  const wDate = doc.getTextWidth(headerRight)
  doc.text(headerRight, PAGE_W - MARGIN - wDate, MARGIN + 12)

  // pozioma linia
  doc.setDrawColor(190)
  doc.line(MARGIN, MARGIN + 14, PAGE_W - MARGIN, MARGIN + 14)

  // ---- GENEROWANIE MINIATUREK (ostre) ----
  // Z góry przygotowujemy dataURL-e, żeby PDF był spójny
  const prepared = await Promise.all(
    items.map(async (it) => {
      const pageUrl = proxifyImage(pages[it.page] || '')
      const dataUrl = await makeThumb(pageUrl, it.rect, {
        pxW: mmToPx(COL_W - 0), // szer. karty ~szer. kolumny
        pxH: mmToPx(IMG_H),
        scale: 2,               // 2× dla ostrości
        background: '#F6F3E9'
      })
      return { ...it, _thumb: dataUrl }
    })
  )

  // ---- RYSOWANIE KART DWUKOLUMNOWO ----
  let col = 0
  for (let i = 0; i < prepared.length; i++) {
    const it = prepared[i]
    const x = MARGIN + col * (COL_W + GUTTER)

    // Nowa strona, gdy zabraknie miejsca
    if (y + CARD_H > PAGE_H - MARGIN) {
      doc.addPage()
      // powtórz nagłówek na nowej stronie
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Lista zakupów', MARGIN, MARGIN + 6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`${shopName}${address ? ' • ' + address : ''}`, MARGIN, MARGIN + 12)
      doc.text(headerRight, PAGE_W - MARGIN - wDate, MARGIN + 12)
      doc.setDrawColor(190)
      doc.line(MARGIN, MARGIN + 14, PAGE_W - MARGIN, MARGIN + 14)

      y = MARGIN + 18
    }

    // KARTA (tło + ramka)
    doc.setDrawColor(200)
    doc.setFillColor(246, 243, 233) // #F6F3E9
    doc.roundedRect(x, y, COL_W, CARD_H, 2, 2, 'FD')

    // Obraz
    const imgX = x + 2
    const imgY = y + 2
    const imgW = COL_W - 4
    const imgH = IMG_H
    if (it._thumb) {
      doc.addImage(it._thumb, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST')
    } else {
      // fallback (puste pole)
      doc.setFillColor(238, 246, 239) // #EEF6EF
      doc.rect(imgX, imgY, imgW, imgH, 'F')
    }

    // Teksty
    let ty = imgY + imgH + 4

    // Tytuł (jedna linia, bez zawijania — równa wysokość karty)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(TITLE_FS)
    doc.setTextColor(10, 64, 12) // #0A400C
    const title = (it.title || 'Produkt').trim()
    // obcięcie, by zmieściło się w kolumnie
    doc.text(clampText(doc, title, COL_W - 6), x + 3, ty)
    ty += 6

    // Cena
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(PRICE_FS)
    doc.setTextColor(179, 150, 89) // #B39659
    doc.text((it.price || '—') + '', x + 3, ty)
    ty += 5 + SPACING

    // Meta: "Str. X • Dziś/Wczoraj/..."
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(META_FS)
    doc.setTextColor(46, 90, 51)
    const meta = `Str. ${Number(it.page) + 1} • ${formatDate(it.at)}`
    doc.text(meta, x + 3, ty)

    // Następna kolumna / rząd
    col = (col + 1) % 2
    if (col === 0) {
      y += CARD_H + 4
    }
  }

  // ---- STOPKA SUMY (tylko gdy jest miejsce na ostatniej stronie) ----
  const total = sumPrices(items)
  if (total != null) {
    const footerY = PAGE_H - MARGIN + 2
    doc.setDrawColor(190)
    doc.line(MARGIN, footerY - 6, PAGE_W - MARGIN, footerY - 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(179, 150, 89)
    const sumText = `Suma: ${formatCurrency(total)}`
    const wSum = doc.getTextWidth(sumText)
    doc.text(sumText, PAGE_W - MARGIN - wSum, footerY)
  }

  // ---- ZAPIS ----
  doc.save(filename)
}

/* -------------- POMOCNICZE -------------- */

function mmToPx(mm) {
  // zakładamy ~96 DPI -> 1mm ≈ 3.78px
  return Math.max(4, Math.round(mm * 3.78))
}

function clampText(doc, text, maxWidthMm) {
  const maxW = Math.max(10, maxWidthMm - 1)
  let t = text
  while (doc.getTextWidth(t) > maxW && t.length > 3) {
    t = t.slice(0, -2)
  }
  if (t !== text) t = t.trimEnd() + '…'
  return t
}

function sumPrices(items) {
  const nums = items
    .filter((s) => !s.done)
    .map((s) => parsePrice(s.price))
    .filter((v) => typeof v === 'number' && !isNaN(v))
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0)
}

function parsePrice(txt) {
  if (!txt) return null
  const s = String(txt).replace(/\s+/g, '').replace(/[zł€$]/gi, '').replace(',', '.')
  const m = s.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  return parseFloat(m[0])
}

function formatCurrency(v) {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2
    }).format(v)
  } catch {
    return `${Number(v || 0).toFixed(2)} zł`
  }
}

function formatDate(tsOrDate) {
  const d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate)
  if (isNaN(d)) return '—'
  const today = new Date()
  const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Dziś'
  if (diff === 1) return 'Wczoraj'
  if (diff < 7) return `${diff} dni temu`
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

/**
 * Tworzy ostrą miniaturę (dataURL JPEG) z przycięciem wg rect [%].
 * - "cover": obraz wypełnia ramkę, bez rozciągania
 * - scale 2× dla ostrości
 */
async function makeThumb(pageUrl, rect, { pxW, pxH, scale = 2, background = '#F6F3E9' } = {}) {
  const img = await loadImage(proxifyImage(pageUrl))

  const { x, y, w, h } = normalizeRect(rect)
  const sx = (img.naturalWidth * x) / 100
  const sy = (img.naturalHeight * y) / 100
  const sw = (img.naturalWidth * w) / 100
  const sh = (img.naturalHeight * h) / 100

  // Canvas w 2× rozdzielczości (retina) => ostre krawędzie w PDF
  const W = Math.max(20, Math.round(pxW * scale))
  const H = Math.max(20, Math.round(pxH * scale))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = W
  canvas.height = H

  // tło
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  // cover scaling (bez rozciągania)
  const scaleCover = Math.max(W / sw, H / sh)
  const dw = sw * scaleCover
  const dh = sh * scaleCover
  const dx = (W - dw) / 2
  const dy = (H - dh) / 2

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)

  return canvas.toDataURL('image/jpeg', 0.92)
}

function normalizeRect(r = {}) {
  const clamp = (v, min, max, d) => {
    v = Number.isFinite(+v) ? +v : d
    return Math.min(max, Math.max(min, v))
  }
  return {
    x: clamp(r.x, 0, 100, 0),
    y: clamp(r.y, 0, 100, 0),
    w: clamp(r.w, 0.001, 100, 100),
    h: clamp(r.h, 0.001, 100, 100)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('Brak src'))
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu: ' + src))
    img.src = src
  })
}
