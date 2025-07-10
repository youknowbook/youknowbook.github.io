import {
  Box,
  Input,
  Text,
  Image,
  Spinner,
  VStack
} from '@chakra-ui/react'
import { forwardRef, useImperativeHandle, useState } from 'react'

const GOOGLE_BOOKS_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY

const BookSearchSelector = forwardRef(({ onBookClick }, ref) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useImperativeHandle(ref, () => ({
    clear() {
      setQuery('')
      setResults([])
    }
  }))

  const handleSearch = async (e) => {
    if (e.key !== 'Enter' || !query) return

    setLoading(true)
    try {
      const langRestrict = /^[\u0000-\u007F]+$/.test(query) ? 'en' : 'hu'
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&langRestrict=${langRestrict}&maxResults=10&key=${GOOGLE_BOOKS_API_KEY}`
      )
      const data = await res.json()
      const items = data.items || []

      const parsed = items.map((item) => {
        const info = item.volumeInfo
        const parsedItem = {
          key: item.id || Math.random().toString(),
          title: info.title || 'Unknown',
          author: (info.authors || ['Unknown'])[0],
          cover_url: info.imageLinks?.thumbnail || '',
          page_count: info.pageCount || null,
          genre: info.categories || [],
          country: info.language || '',
        }
        console.log("📘 Parsed book:", parsedItem)
        return parsedItem
      })

      setResults(parsed)
    } catch (err) {
      console.error('Search error:', err)
      setResults([])
    }
    setLoading(false)
  }

  return (
    <Box>
      <Input
        placeholder="Search for a book (press Enter)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleSearch}
      />

      {loading && <Spinner mt={4} />}

      <VStack spacing={3} mt={4} align="stretch">
        {results.map((book) => (
          <Box
            key={book.key}
            p={3}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            _hover={{ bg: 'gray.50', cursor: 'pointer' }}
            onClick={() => {
              console.log("✅ Book clicked:", book)
              onBookClick(book)
              setQuery('')
              setResults([])
            }}
            display="flex"
            alignItems="center"
          >
            {book.cover_url && (
              <Image
                src={book.cover_url}
                boxSize="50px"
                objectFit="cover"
                mr={4}
                alt={book.title}
              />
            )}
            <Box>
              <Text fontWeight="bold">{book.title}</Text>
              <Text fontSize="sm" color="gray.600">{book.author}</Text>
            </Box>
          </Box>
        ))}
      </VStack>
    </Box>
  )
})
export default BookSearchSelector
