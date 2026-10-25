export const CARD_WIDTH = 184
const GAP = 24
const MARGIN = CARD_WIDTH / 2 + 28

export function groupTimelineBooks(books) {
  const years = new Map()
  const unknown = []
  for (const book of books) {
    const year = Number(book.release_year)
    if (book.release_year == null || String(book.release_year).trim() === '' || !Number.isInteger(year)) {
      unknown.push(book)
      continue
    }
    if (!years.has(year)) years.set(year, [])
    years.get(year).push(book)
  }
  return { groups: [...years].sort(([a], [b]) => a - b).map(([year, books]) => ({ year, books })), unknown }
}

export function yearLabel(year) {
  return year < 0 ? `i. e. ${Math.abs(year)}` : String(year)
}

// Keep a proportional date axis. Displace only the cards when adjacent dates
// would overlap; the arrows retain their exact positions on that axis.
export function timelineLayout(groups, availableWidth = 900) {
  const perSide = Math.ceil(groups.length / 2)
  const width = Math.max(900, availableWidth, MARGIN * 2 + Math.max(0, perSide - 1) * (CARD_WIDTH + GAP))
  const first = groups[0]?.year ?? 0
  const last = groups.at(-1)?.year ?? first
  const padding = Math.max(1, (last - first) * 0.04)
  const minYear = first - padding
  const maxYear = last + padding
  const xForYear = year => MARGIN + ((year - minYear) / (maxYear - minYear)) * (width - 2 * MARGIN)
  const cards = groups.map((group, i) => ({
    ...group,
    above: i % 2 === 0,
    anchorX: xForYear(group.year),
    height: 56 + Math.ceil(group.books.length / 2) * 140 + (Math.ceil(group.books.length / 2) - 1) * 12,
  }))
  for (const above of [true, false]) {
    const row = cards.filter(card => card.above === above)
    let previous = MARGIN - CARD_WIDTH - GAP
    for (const card of row) {
      card.centerX = Math.max(card.anchorX, previous + CARD_WIDTH + GAP)
      previous = card.centerX
    }
    let next = width - MARGIN + CARD_WIDTH + GAP
    for (const card of [...row].reverse()) {
      card.centerX = Math.min(card.centerX, next - CARD_WIDTH - GAP)
      next = card.centerX
    }
  }
  const aboveHeight = Math.max(0, ...cards.filter(card => card.above).map(card => card.height))
  const belowHeight = Math.max(0, ...cards.filter(card => !card.above).map(card => card.height))
  const axisY = aboveHeight + 88
  for (const card of cards) {
    card.top = card.above ? axisY - 64 - card.height : axisY + 64
    card.edgeY = card.above ? card.top + card.height + 5 : card.top - 5
  }
  const height = axisY + (belowHeight ? 64 + belowHeight : 0) + 40
  const rawStep = (maxYear - minYear) / Math.max(2, Math.floor(width / 120))
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = Math.max(1, [1, 2, 5, 10].map(n => n * magnitude).find(n => n >= rawStep))
  const ticks = []
  for (let year = Math.ceil(minYear / step) * step; year <= maxYear; year += step) {
    ticks.push({ year, x: xForYear(year) })
  }
  return { width, height, axisY, cards, ticks }
}
