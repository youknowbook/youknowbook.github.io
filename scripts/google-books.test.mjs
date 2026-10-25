import test from 'node:test'
import assert from 'node:assert/strict'
import { googleBooksUrl, searchGoogleBooks } from '../src/api/googleBooks.js'

const response = (data, status = 200) => async () => ({ ok: status === 200, status, json: async () => data })

test('Hungarian searches are never restricted to English; absent keys are omitted', () => {
  for (const query of ['Egri csillagok', 'Száz év magány', 'title & author']) {
    const url = googleBooksUrl(query)
    assert.equal(url.searchParams.get('q'), query)
    assert.equal(url.searchParams.has('langRestrict'), false)
    assert.equal(url.searchParams.has('key'), false)
  }
  assert.equal(googleBooksUrl('book', ' test-key ').searchParams.get('key'), 'test-key')
})

test('403 API errors are visible instead of silently looking like zero results', async () => {
  await assert.rejects(searchGoogleBooks('book', { fetcher: response({ error: { message: 'API key not valid' } }, 403) }), /403.*API key not valid/)
})

test('quota exhaustion and network failures have actionable messages', async () => {
  await assert.rejects(searchGoogleBooks('book', { fetcher: response({ error: { message: 'Quota exceeded' } }, 429) }), /429.*Quota exceeded/)
  await assert.rejects(searchGoogleBooks('book', { fetcher: async () => { throw new TypeError('Failed to fetch') } }), /internetkapcsolatot/)
})

test('zero results are valid, and incomplete volumes do not crash the selector', async () => {
  assert.deepEqual(await searchGoogleBooks('book', { fetcher: response({ totalItems: 0 }) }), [])
  const books = await searchGoogleBooks('book', { fetcher: response({ items: [{ id: 'empty' }, {
    id: 'full', volumeInfo: { title: 'Title', authors: ['One', 'Two'], language: 'hu', publishedDate: '1984-01-01', imageLinks: { thumbnail: 'http://example.com/cover' } },
  }] }) })
  assert.equal(books[0].title, '')
  assert.equal(books[1].author, 'One, Two')
  assert.equal(books[1].country, '')
  assert.equal(books[1].release_year, '1984')
  assert.equal(books[1].cover_url, 'https://example.com/cover')
})

test('aborted searches are propagated without a misleading network error', async () => {
  await assert.rejects(searchGoogleBooks('book', { fetcher: async () => { throw new DOMException('Aborted', 'AbortError') } }), { name: 'AbortError' })
})

test('503 service failures get a retry hint rather than suggesting a key replacement', async () => {
  await assert.rejects(searchGoogleBooks('book', { fetcher: response({ error: { message: 'Service temporarily unavailable.' } }, 503) }), /503.*átmenetileg/)
})

test('non-JSON error pages remain actionable', async () => {
  await assert.rejects(searchGoogleBooks('book', { fetcher: async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('HTML') } }) }), /502.*Érvénytelen szerverválasz/)
})
