import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Heading,
  Tabs,
  Text,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'
import BookSearchSelector from '../components/Books/BookSearchSelector'
import BookEditModal from '../components/Books/BookEditModal'
import BookMetaModal from '../components/Books/BookMetaModal'
import { FaStar, FaStarHalfAlt, FaRegStar, FaTh, FaBars } from 'react-icons/fa'

export default function Books() {
  const { user } = useAuth()
  const [books, setBooks] = useState([])
  const [userMeta, setUserMeta] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [editBook, setEditBook] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [metaModalBook, setMetaModalBook] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const [activeTab, setActiveTab] = useState('readings')
  const searchRef = useRef()

  // fetch all books
  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, added_by, user_id, is_selected, cover_url')
    if (error) console.error(error)
    else setBooks(data)
  }

  // fetch user_meta
  const fetchMeta = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('user_books')
      .select('*')
      .eq('user_id', user.id)
    if (!error) {
      const m = {}
      data.forEach(r => { m[r.book_id] = r })
      setUserMeta(m)
    }
  }

  // on mount/load
  useEffect(() => {
    if (!user) return
    supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error) setIsAdmin(data.is_admin)
      })
    fetchBooks()
  }, [user])

  useEffect(() => {
    fetchMeta()
  }, [user])

  // upsert helper
  async function upsertColumn(bookId, column, value) {
    const existing = userMeta[bookId] || {}
    const payload = {
      user_id:    user.id,
      book_id:    bookId,
      status:     column === 'status'     ? value : existing.status     || 'not_read',
      mood_color: column === 'mood_color' ? value : existing.mood_color || '#ffffff',
      rating:     column === 'rating'     ? value : existing.rating     ?? null,
    }
    await supabase
      .from('user_books')
      .upsert(payload, { onConflict: ['user_id','book_id'] })
    setUserMeta(m => ({ ...m, [bookId]: payload }))
  }
  const saveStatus = (id,s) => upsertColumn(id,'status',s)
  const saveMood   = (id,c) => upsertColumn(id,'mood_color',c)
  const saveRating = (id,r) => upsertColumn(id,'rating',r)

  // delete book
  const handleDelete = async id => {
    await supabase.from('books').delete().eq('id', id)
    fetchBooks()
  }

  // render stars helper
  const renderStars = (rating=0) => {
    const full = Math.floor(rating/2)
    const half = rating%2===1
    const empty = 5-full-(half?1:0)
    return (
      <HStack spacing="1">
        {[...Array(full)].map((_,i)=><FaStar key={i} size={20}/>)}
        {half && <FaStarHalfAlt size={20} />}
        {[...Array(empty)].map((_,i)=><FaRegStar key={i} size={20}/>)}
      </HStack>
    )
  }

  return (
    <Box maxW="4xl" mx="auto" mt={6} px={4}>
      <HStack justify="space-between" align="center" mb={6}>
        <Heading mb={4}>📚 Books</Heading>
        {activeTab === 'readings' && (
          <HStack justify="flex-end" mb={4}>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'solid' : 'outline'}
              leftIcon={<FaBars />}
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'solid' : 'outline'}
              leftIcon={<FaTh />}
              onClick={() => setViewMode('grid')}
            >
              Tiles
            </Button>
          </HStack>
        )}
      </HStack>

      <Tabs.Root defaultValue="readings" onValueChange={(v) => setActiveTab(v)}>
        <Tabs.List mb={4} gap={4}>
          <Tabs.Trigger value="readings">📖 Readings</Tabs.Trigger>
          <Tabs.Trigger value="waitlist">📚 Waitlist</Tabs.Trigger>
        </Tabs.List>

        {/* — Readings: open Meta Modal + Revert + display color & stars */}
        <Tabs.Content value="readings">
          {viewMode === 'list' ? (
            <VStack spacing={3} align="stretch">
              {books.filter(b => b.is_selected).map(book => {
                const meta = userMeta[book.id] || {}
                return (
                  <HStack
                    key={book.id}
                    bg={meta.mood_color || '#ffffff'}
                    p={3}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    align="center"
                    spacing={3}
                    onClick={() => setMetaModalBook(book)}
                    cursor="pointer"
                  >
                    {/* cover */}
                    <Box w="80px" h="80px" flexShrink={0} overflow="hidden" borderRadius="md" bg="gray.100">
                      <img
                        src={book.cover_url || 'https://via.placeholder.com/80?text=No+Cover'}
                        alt={`${book.title} cover`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => {
                          e.currentTarget.onerror = null
                          e.currentTarget.src = 'https://via.placeholder.com/80?text=No+Cover'
                        }}
                      />
                    </Box>
                    {/* text */}
                    <VStack spacing={0} align="start" flex="1" ml={2}>
                      <Text fontWeight="bold" fontSize="md" noOfLines={1}>{book.title}</Text>
                      <Text fontSize="sm" color="blackAlpha.800" noOfLines={1}>{book.author}</Text>
                      <Text fontSize="xs" color="blackAlpha.600" noOfLines={1}>added by {book.added_by}</Text>
                    </VStack>
                    {/* stars */}
                    {meta.rating > 0 && (
                      <HStack spacing={0} mr={2}>
                        {renderStars(meta.rating)}
                      </HStack>
                    )}
                    {/* revert */}
                    {isAdmin && (
                      <Button
                        size="xs"
                        onClick={async e => {
                          e.stopPropagation()
                          await supabase.from('meetings').delete().eq('book_id', book.id)
                          await supabase.from('books').update({ is_selected: false }).eq('id', book.id)
                          fetchBooks()
                        }}
                      >
                        Revert
                      </Button>
                    )}
                  </HStack>
                )
              })}
            </VStack>
          ) : (
            <Wrap spacing="4">
              {books.filter(b => b.is_selected).map(book => {
                const meta = userMeta[book.id] || {}
                return (
                  <WrapItem key={book.id}>
                    <Box
                      bg={meta.mood_color || '#ffffff'}
                      p={3}                          // just a little padding
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      display="flex"
                      flexDir="column"
                      alignItems="center"
                      cursor="pointer"
                      onClick={() => setMetaModalBook(book)}
                    >
                      {/* cover */}
                      <Box w="100px" h="100px" overflow="hidden" borderRadius="md" bg="gray.100">
                        <img
                          src={book.cover_url || 'https://via.placeholder.com/100?text=No+Cover'}
                          alt={`${book.title} cover`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={e => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Cover'
                          }}
                        />
                      </Box>

                      {/* stars */}
                      {meta.rating > 0 && (
                        <Box mt={1}>
                          {renderStars(meta.rating)}
                        </Box>
                      )}
                    </Box>
                  </WrapItem>
                )
              })}
            </Wrap>
          )}
        </Tabs.Content>

        {/* — Waitlist: Edit Modal + Delete */}
        <Tabs.Content value="waitlist">
          <BookSearchSelector
            onBookClick={b=>{ setEditBook(b); setAddModalOpen(true) }}
            ref={searchRef}
          />
          <VStack spacing={4} mt={6} align="stretch">
            {books.filter(b=>!b.is_selected).map(book=>(
              <Box
                key={book.id}
                p={3}
                border="1px solid" 
                borderColor="gray.200"
                borderRadius="md"
                justifyItems={'center'}
              >
                <HStack spacing={2} mb={2}>
                  <Box
                    width="80px"
                    height="80px"
                    flexShrink={0}
                    overflow="hidden"
                    borderRadius="md"
                    bg="gray.100"
                    mr={6}
                  >
                    <img
                      src={book.cover_url || 'https://via.placeholder.com/80?text=No+Cover'}
                      alt={`${book.title} cover`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = 'https://via.placeholder.com/80?text=No+Cover'
                      }}
                    />
                  </Box>
                  <Box >
                    <Text fontWeight="bold">{book.title}</Text>
                    <Text fontSize="sm" color="gray.600">by {book.author}</Text>
                    <Text fontSize="xs" color="gray.500">added by {book.added_by}</Text>
                  </Box>
                  <VStack mt={2} justify="end" align="end" spacing={1} ml={4}>
                    <Button
                      size="xs"
                      onClick={()=>{ setEditBook(book); setAddModalOpen(true) }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs" 
                      onClick={()=>handleDelete(book.id)}
                    >
                      Delete
                    </Button>
                  </VStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        </Tabs.Content>
      </Tabs.Root>

      {/* Add/Edit Book */}
      {addModalOpen && (
        <BookEditModal
          book={editBook}
          isOpen
          onClose={()=>{ setAddModalOpen(false); setEditBook(null) }}
          onBookAdded={()=>{ fetchBooks(); fetchMeta() }}
          clearSearch={()=>searchRef.current?.clear()}
        />
      )}

      {/* Meta (status/rating/color) */}
      {metaModalBook && (
        <BookMetaModal
          isOpen
          onClose={()=>setMetaModalBook(null)}
          book={metaModalBook}
          initialMeta={userMeta[metaModalBook.id]||{}}
          onSave={(id,newMeta)=>{
            saveStatus(id,newMeta.status)
            saveMood(id,newMeta.mood_color)
            saveRating(id,newMeta.rating)
          }}
        />
      )}
    </Box>
  )
}
