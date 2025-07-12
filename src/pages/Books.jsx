import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Heading,
  Tabs,
  useTabs,
  Text,
  Button,
  VStack,
  HStack,
  Flex,
  SimpleGrid,
  Icon,
  Stack,
  Popover,
  Portal,
} from '@chakra-ui/react'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'
import BookSearchSelector from '../components/Books/BookSearchSelector'
import BookEditModal from '../components/Books/BookEditModal'
import BookMetaModal from '../components/Books/BookMetaModal'
import BookDetailModal from '../components/Books/BookDetailModal'
import { FaStar, FaStarHalfAlt, FaRegStar, FaTh, FaBars } from 'react-icons/fa'

export default function Books() {
  const { user } = useAuth()
  const tabs = useTabs({ defaultValue: 'readings' })
  const activeTab = tabs.value
  const [books, setBooks] = useState([])
  const [userMeta, setUserMeta] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [editBook, setEditBook] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [metaModalBook, setMetaModalBook] = useState(null)
  const [detailModalBook, setDetailModalBook] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const searchRef = useRef()

  // fetch all books
  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, added_by, is_selected, cover_url')
    if (error) console.error(error)
    else setBooks(data)
  }

  // fetch user_books and normalize mood_color → always “#rrggbb”
  const fetchMeta = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('user_books')
      .select('user_id, book_id, status, mood_color, rating')
      .eq('user_id', user.id)
    if (error) {
      console.error(error)
      return
    }
    const m = {}
    data.forEach(r => {
      // ensure a single “#”
      const raw = (r.mood_color || 'ffffff').replace(/^#/, '').slice(0,6)
      m[r.book_id] = {
        ...r,
        mood_color: `#${raw}`
      }
    })
    setUserMeta(m)
  }

  // single upsert when modal “Save” is clicked
  const handleMetaSave = async (bookId, { status, mood_color, rating }) => {
    const raw = mood_color.replace(/^#/, '').slice(0,6)
    const payload = {
      user_id:    user.id,
      book_id:    bookId,
      status,
      mood_color: raw,
      rating
    }
    const { error } = await supabase
      .from('user_books')
      .upsert(payload, { onConflict: ['user_id','book_id'] })

    if (error) {
      console.error('Failed to save:', error)
    } else {
      // optimistic local update
      setUserMeta(m => ({
        ...m,
        [bookId]: { ...payload, mood_color: `#${raw}` }
      }))
    }
  }

  // delete book
  const handleDelete = async id => {
    await supabase.from('books').delete().eq('id', id)
    fetchBooks()
  }

  // render stars
  const renderStars = (rating = 0) => {
    const full = Math.floor(rating / 2)
    const half = rating % 2 === 1
    const empty = 5 - full - (half ? 1 : 0)
    return (
      <HStack spacing="1">
        {[...Array(full)].map((_, i) => (
          <Icon as={FaStar} key={`f${i}`} fontSize={{ base: '14px', sm: "16px", md: '20px' }} />
        ))}
        {half && <Icon as={FaStarHalfAlt} fontSize={{ base: '14px', sm: "16px", md: '20px' }} />}
        {[...Array(empty)].map((_, i) => (
          <Icon as={FaRegStar} key={`e${i}`} fontSize={{ base: '14px', sm: "16px", md: '20px' }} />
        ))}
      </HStack>
    )
  }

  useEffect(() => {
    if (!user) return
    // load admin flag
    supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error) setIsAdmin(data.is_admin)
      })
    fetchBooks()
    fetchMeta()
  }, [user])

  return (
    <Box maxW="4xl" mx="auto" mt={6} px={4}>
      <HStack justify="space-between" align="center" mb={6}>
        <Heading>📚 Könyvsarok</Heading>
        {tabs.value === 'readings' && (
          <HStack>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'solid' : 'outline'}
              leftIcon={<FaBars />}
              onClick={() => setViewMode('list')}
            >Lista</Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'solid' : 'outline'}
              leftIcon={<FaTh />}
              onClick={() => setViewMode('grid')}
            >Csempe</Button>
          </HStack>
        )}
      </HStack>

      <Tabs.RootProvider value={tabs}>
        <Tabs.List mb={4} gap={4}>
          <Tabs.Trigger value="readings">📖 Olvasottak</Tabs.Trigger>
          <Tabs.Trigger value="waitlist">📚 Várólista</Tabs.Trigger>
        </Tabs.List>

        {/* Readings */}
        <Tabs.Content value="readings">
          {viewMode === 'list' ? (
            <VStack spacing={3} align="stretch">
              {books.filter(b => b.is_selected).map(book => {
                const meta = userMeta[book.id] || {}
                return (
                  <Box
                    key={book.id}
                    onClick={() => setMetaModalBook(book)}
                    cursor="pointer"
                    bg={meta.mood_color || '#ffffff'}
                    p={3}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                  >
                    <Flex align="center" wrap="wrap">
                      <Box
                        w={{ base: '60px', md: '80px' }}
                        h={{ base: '60px', md: '80px' }}
                        overflow="hidden"
                        borderRadius="md"
                        bg="gray.100"
                        mr={4}
                      >
                        <img
                          src={book.cover_url || 'https://via.placeholder.com/80?text=No+Cover'}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <Box flex="1" minW="0" mr={4}>
                        <Text fontSize={{ base: 'sm', md: 'md' }} fontWeight="bold" noOfLines={1}>{book.title}</Text>
                        <Text fontSize={{ base: 'xs', md: 'sm' }} color="blackAlpha.800" noOfLines={1}>{book.author}</Text>
                        <Text fontSize={{ base: 'xx-small', md: 'xs' }} color="blackAlpha.600" noOfLines={1}>
                          Hozzáadta: {book.added_by}
                        </Text>
                      </Box>
                      <HStack spacing={2} ml="auto">
                        {meta.rating > 0 && renderStars(meta.rating)}
                      </HStack>
                    </Flex>
                  </Box>
                )
              })}
            </VStack>
            ) : (
              <SimpleGrid
                columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }}
                columnGap="0"
                rowGap="4"
                justifyItems="center"
              >
                {books.filter(b => b.is_selected).map(book => {
                  const meta = userMeta[book.id] || {}
                  return (
                    <Box
                      key={book.id}
                      w="80%"
                      aspectRatio="3 / 4"
                      bg={meta.mood_color || '#ffffff'}
                      p={3}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      display="flex"
                      flexDirection="column"
                      justifyContent="space-between"
                      cursor="pointer"
                      onClick={() => setMetaModalBook(book)}
                    >
                      <Box overflow="hidden" borderRadius="md" bg="gray.100" flex="1">
                        <img
                          src={book.cover_url || 'https://via.placeholder.com/150?text=No+Cover'}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                      <Box
                        h="10%"
                        mt={4}
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                      >
                        {meta.rating > 0 ? renderStars(meta.rating) : null}
                      </Box>
                    </Box>
                  )
                })}
              </SimpleGrid>
            )}
        </Tabs.Content>

        {/* Waitlist */}
        <Tabs.Content value="waitlist">
          <BookSearchSelector
            onBookClick={b => { setEditBook(b); setAddModalOpen(true) }}
            ref={searchRef}
          />
          <VStack spacing={4} mt={6} align="stretch">
            {books.filter(b => !b.is_selected).map(book => (
              <Box
                key={book.id}
                bg="white" p={3} border="1px solid" borderColor="gray.200"
                onClick={() => setDetailModalBook(book)}
                borderRadius="md"
              >
                <Flex align="center" justify="space-between" wrap="wrap">
                  <Flex align="center" flex="1" minW="0">
                    <Box
                      w={{ base: '60px', md: '80px' }}
                      h={{ base: '60px', md: '80px' }}
                      overflow="hidden"
                      borderRadius="md"
                      bg="gray.100"
                      mr={4}
                    >
                      <img
                        src={book.cover_url || 'https://via.placeholder.com/80?text=No+Cover'}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </Box>
                    <Box flex="1" minW="0">
                      <Text fontWeight="bold" noOfLines={1}>{book.title}</Text>
                      <Text fontSize="sm" color="blackAlpha.800" noOfLines={1}>{book.author}</Text>
                      <Text fontSize="xs" color="blackAlpha.600" noOfLines={1}>
                        Hozzáadta: {book.added_by}
                      </Text>
                    </Box>
                  </Flex>
                  <Stack direction={{ base: 'column', md: 'row' }} spacing={2} flex="0">
                    <Button
                      size="xs"
                      onClick={e => {
                        e.stopPropagation()
                        setEditBook(book)
                        setAddModalOpen(true)
                      }}
                    >
                      Szerkeszt
                    </Button>

                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <Button
                          size="xs"
                          colorScheme="red"
                          onClick={e => e.stopPropagation()}
                        >
                          Töröl
                        </Button>
                      </Popover.Trigger>
                      <Portal>
                        <Popover.Positioner>
                          <Popover.Content bg="red.50" p={4} borderRadius="md" w="240px">
                            <Popover.Body>
                              <Popover.Title
                                fontSize="md"
                                fontWeight="bold"
                                color="red.800"
                              >
                                Törlés megerősítése
                              </Popover.Title>
                              <Text fontSize="sm" color="red.700" my={2}>
                                Biztosan törölni szeretnéd ezt a könyvet?
                              </Text>
                              <HStack justify="flex-end" spacing={2}>
                                <Popover.CloseTrigger asChild>
                                  <Button size="xs">Vissza</Button>
                                </Popover.CloseTrigger>
                                <Button
                                  size="xs"
                                  colorScheme="red"
                                  onClick={async e => {
                                    e.stopPropagation()
                                    await handleDelete(book.id)
                                  }}
                                >
                                  Törlés
                                </Button>
                              </HStack>
                            </Popover.Body>
                          </Popover.Content>
                        </Popover.Positioner>
                      </Portal>
                    </Popover.Root>
                  </Stack>
                </Flex>
              </Box>
            ))}
          </VStack>
        </Tabs.Content>
      </Tabs.RootProvider>

      {addModalOpen && (
        <BookEditModal
          book={editBook}
          isOpen
          onClose={() => { setAddModalOpen(false); setEditBook(null) }}
          onBookAdded={() => { fetchBooks(); fetchMeta() }}
          clearSearch={() => searchRef.current?.clear()}
        />
      )}

      {metaModalBook && (
        <BookMetaModal 
          isOpen 
          onClose={() => setMetaModalBook(null)} 
          book={metaModalBook} 
          initialMeta={userMeta[metaModalBook.id] || {}} 
          onSave={handleMetaSave} 
          isAdmin={isAdmin} 
          onRevert={async (bookId) => { 
            await supabase 
              .from('books') 
              .update({ is_selected: false }) 
              .eq('id', bookId) 
            fetchBooks() 
          }} 
        /> 
      )} 

      {detailModalBook && (
        <BookDetailModal
          book={detailModalBook}
          isOpen={!!detailModalBook}
          onClose={() => setDetailModalBook(null)}
        />
      )}
      
    </Box>
  )
}
