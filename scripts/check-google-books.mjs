import dotenv from 'dotenv'
import { googleBooksUrl } from '../src/api/googleBooks.js'

// Match Vite's local development priority without printing credentials.
dotenv.config({ path: ['.env.development.local', '.env.local', '.env.development', '.env'], quiet: true })
const apiKey = process.env.VITE_GOOGLE_BOOKS_API_KEY
console.log(`Google Books key configured: ${Boolean(apiKey?.trim())}`)
try {
  const response = await fetch(googleBooksUrl(process.argv[2] || 'Egri csillagok', apiKey), { signal: AbortSignal.timeout(15000) })
  const data = await response.json()
  const message = String(data.error?.message || '').replaceAll(apiKey || '__NO_KEY__', '[redacted]')
  console.log(JSON.stringify({ status: response.status, totalItems: data.totalItems, returnedItems: data.items?.length || 0, error: message || undefined }, null, 2))
  if (!response.ok) process.exitCode = 1
} catch {
  console.error('Google Books request failed before an API response. Check network/DNS access.')
  process.exitCode = 1
}
