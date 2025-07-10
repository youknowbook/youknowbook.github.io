// Books.jsx
import { useEffect, useRef, useState } from 'react'
import {
  Box, Heading, useDisclosure, Tabs, Text, Button, VStack
} from '@chakra-ui/react'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'
import BookSearchSelector from '../components/Books/BookSearchSelector'
import BookEditModal from '../components/Books/BookEditModal'

export default function Books() {
  const { user } = useAuth()
  const [selectedBook, setSelectedBook] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [books, setBooks] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)

  const searchRef = useRef()

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, added_by, user_id')

    if (!error) setBooks(data)
  }

  const handleBookClick = (book) => {
    setSelectedBook(book)
    onOpen()
  }

  useEffect(() => {
    async function checkAdmin() {
      const { data } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      setIsAdmin(data?.is_admin || false)
    }

    if (user) {
      fetchBooks()
      checkAdmin()
    }
  }, [user])

  const handleEdit = async (book) => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', book.id)
      .single()

    if (!error && data) {
      setSelectedBook(data)
      onOpen()
    } else {
      console.error("❌ Failed to fetch book:", error)
    }
  }


  const handleDelete = async (bookId) => {
    await supabase.from('books').delete().eq('id', bookId)
    setBooks(books.filter(book => book.id !== bookId))
  }

  return (
    <Box maxW="4xl" mx="auto" mt={6} px={4}>
      <Heading mb={4}>📚 Books</Heading>

      <Tabs.Root defaultValue="readings">
        <Tabs.List mb={4} gap={4}>
          <Tabs.Trigger value="readings">📖 Readings</Tabs.Trigger>
          <Tabs.Trigger value="waitlist">📚 Waitlist</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="readings">
          <Box>📖 Reading list goes here.</Box>
        </Tabs.Content>

        <Tabs.Content value="waitlist">
          <BookSearchSelector onBookClick={handleBookClick} ref={searchRef} />

          <VStack spacing={4} mt={6} align="stretch">
            {books.map(book => (
              <Box
                key={book.id}
                p={4}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
              >
                <Text fontWeight="bold">{book.title}</Text>
                <Text fontSize="sm" color="gray.600">by {book.author}</Text>
                <Text fontSize="xs" color="gray.500">Added by: {book.added_by}</Text>

                {(isAdmin || book.user_id === user.id) && (
                  <Box mt={2} display="flex" gap={2}>
                    <Button size="sm" onClick={() => handleEdit(book)}>Edit</Button>
                    <Button size="sm" colorScheme="red" onClick={() => handleDelete(book.id)}>Delete</Button>
                  </Box>
                )}
              </Box>
            ))}
          </VStack>
        </Tabs.Content>
      </Tabs.Root>

      {selectedBook && (
        <BookEditModal
          book={selectedBook}
          isOpen={isOpen}
          onClose={() => {
            onClose()
            setSelectedBook(null)
          }}
          onBookAdded={fetchBooks}
          clearSearch={() => searchRef.current?.clear()}
        />
      )}
    </Box>
  )
}
