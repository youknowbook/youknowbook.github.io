export function googleBooksUrl(query, apiKey) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query.trim())
  url.searchParams.set('maxResults', '10')
  if (apiKey?.trim()) url.searchParams.set('key', apiKey.trim())
  return url
}

export async function searchGoogleBooks(query, { apiKey, signal, fetcher = fetch } = {}) {
  let res
  try {
    res = await fetcher(googleBooksUrl(query, apiKey), { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('A Google Books nem érhető el. Ellenőrizd az internetkapcsolatot, vagy adj hozzá könyvet kézzel.')
  }
  const data = await res.json().catch(() => ({ error: { message: 'Érvénytelen szerverválasz' } }))
  if (!res.ok || data.error) {
    const message = String(data.error?.message || res.statusText).replaceAll(apiKey || '__NO_KEY__', '[redacted]')
    const hint = res.status >= 500
      ? 'A Google szolgáltatása átmenetileg nem érhető el. Próbáld újra később, vagy adj hozzá könyvet kézzel.'
      : res.status === 429
        ? 'A keresési kvóta elfogyott. Próbáld újra később, vagy adj hozzá könyvet kézzel.'
        : 'Ellenőrizd az API-kulcsot, a Books API engedélyezését és a webhelykorlátozásokat.'
    throw new Error(`Google Books hiba (${res.status}): ${message}. ${hint}`)
  }
  return (data.items || []).map(item => {
    const info = item.volumeInfo || {}
    return {
      key: item.id,
      title: info.title || '',
      author: (info.authors || []).join(', '),
      cover_url: (info.imageLinks?.thumbnail || '').replace(/^http:/, 'https:'),
      page_count: info.pageCount || '',
      genre: info.categories || [],
      release_year: /^-?\d{1,4}/.exec(info.publishedDate || '')?.[0] || '',
      // Language is not the author's country of origin.
      country: '',
    }
  })
}
