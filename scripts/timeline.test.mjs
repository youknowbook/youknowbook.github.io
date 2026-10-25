import test from 'node:test'
import assert from 'node:assert/strict'
import { CARD_WIDTH, groupTimelineBooks, timelineLayout } from '../src/components/Stats/timelineLayout.js'
const book = (id, release_year) => ({ id, release_year })

test('numeric and string years group together; unknown dates stay off the axis', () => {
  const { groups, unknown } = groupTimelineBooks([book(1, 1900), book(2, '1900'), book(3, null), book(4, ' '), book(5, 'unknown'), book(6, -500)])
  assert.deepEqual(groups.map(group => group.year), [-500, 1900])
  assert.equal(groups[1].books.length, 2)
  assert.equal(unknown.length, 3)
})

test('year anchors use proportional time distances rather than equal bins', () => {
  const { groups } = groupTimelineBooks([book(1, 1800), book(2, 1900), book(3, 1910)])
  const { cards } = timelineLayout(groups)
  assert.ok(Math.abs((cards[1].anchorX - cards[0].anchorX) / (cards[2].anchorX - cards[1].anchorX) - 10) < 0.0001)
})

test('crowded recent years and an ancient outlier never overlap cards or escape the canvas', () => {
  const { groups } = groupTimelineBooks([book('old', -2000), ...Array.from({ length: 24 }, (_, i) => book(i, 2000 + i))])
  const layout = timelineLayout(groups, 375)
  for (const card of layout.cards) {
    assert.ok(Number.isFinite(card.centerX) && Number.isFinite(card.anchorX))
    assert.ok(card.centerX - CARD_WIDTH / 2 >= 0)
    assert.ok(card.centerX + CARD_WIDTH / 2 <= layout.width)
    assert.ok(card.top >= 0 && card.top + card.height <= layout.height)
  }
  for (const above of [true, false]) {
    const row = layout.cards.filter(card => card.above === above)
    for (let i = 1; i < row.length; i++) assert.ok(row[i].centerX - row[i - 1].centerX >= CARD_WIDTH + 24)
  }
})

test('one year, no books, and multiple books per year all have finite geometry', () => {
  for (const input of [[], [book(1, 2000)], Array.from({ length: 12 }, (_, i) => book(i, 2000))]) {
    const layout = timelineLayout(groupTimelineBooks(input).groups)
    assert.ok(Number.isFinite(layout.width) && Number.isFinite(layout.height))
    assert.ok(layout.ticks.every(tick => Number.isFinite(tick.x)))
  }
})
