import { Box, Button, Input, Text, Image, Spinner, VStack, HStack } from '@chakra-ui/react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { searchGoogleBooks } from '../../api/googleBooks'

const BookSearchSelector = forwardRef(({ onBookClick, allowCustom = false }, ref) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])
  const clear = () => {
    request.current?.abort()
    setQuery('')
    setResults([])
    setError('')
    setSearched(false)
    setLoading(false)
  }
  useImperativeHandle(ref, () => ({ clear }))
  const handleSearch = async e => {
    e.preventDefault()
    if (!query.trim()) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setResults([])
    setSearched(false)
    try {
      const books = await searchGoogleBooks(query, {
        apiKey: import.meta.env.VITE_GOOGLE_BOOKS_API_KEY,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setResults(books)
        setSearched(true)
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  const choose = book => { onBookClick(book); clear() }
  return (
    <Box>
      <HStack as="form" onSubmit={handleSearch}>
        <Input aria-label="Google Books keresés" placeholder="Keress könyvet cím vagy szerző alapján"
          value={query} onChange={e => {
            request.current?.abort()
            setLoading(false)
            setQuery(e.target.value)
            setResults([])
            setError('')
            setSearched(false)
          }} />
        <Button type="submit" disabled={loading || !query.trim()}>Keresés</Button>
      </HStack>
      {loading && <Spinner mt={4} />}
      {error && <Text role="alert" mt={3} color="red.600">{error}</Text>}
      {searched && !results.length && <Text mt={3}>Nincs találat.</Text>}
      <VStack gap={3} mt={4} align="stretch" maxH="min(50dvh, 420px)" overflowY="auto">
        {results.map(book => (
          <Box as="button" type="button" textAlign="left" key={book.key} p={3}
            border="1px solid" borderColor="gray.200" borderRadius="md"
            _hover={{ bg: 'gray.50' }} onClick={() => choose(book)}
            display="flex" alignItems="center" flexShrink={0}>
            {book.cover_url && <Image src={book.cover_url} boxSize="50px" objectFit="cover" mr={4} alt={book.title} />}
            <Box><Text fontWeight="bold">{book.title}</Text><Text fontSize="sm">{book.author}</Text></Box>
          </Box>
        ))}
        {allowCustom && (
          <Button variant="outline" flexShrink={0} whiteSpace="normal" height="auto" py={3}
            onClick={() => choose({ title: query.trim(), genre: [] })}>
            ＋ Könyv hozzáadása kézzel
          </Button>
        )}
      </VStack>
    </Box>
  )
})
export default BookSearchSelector
