import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  Select,
  IconButton,
  Checkbox,
  CheckboxGroup,
  Fieldset,
  RadioGroup,
  createListCollection,
  Separator
} from '@chakra-ui/react'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'
import BookSearchSelector from '../components/Books/BookSearchSelector'
import BookEditModal from '../components/Books/BookEditModal'
import BookMetaModal from '../components/Books/BookMetaModal'
import BookDetailModal from '../components/Books/BookDetailModal'
import { FaStar, FaStarHalfAlt, FaRegStar, FaTh, FaBars } from 'react-icons/fa'
import {
  FaCheck, FaTimes, FaFilter, FaGlobe, FaVenusMars,
  FaSortAmountUp, FaSortAmountDown, FaSort,
} from 'react-icons/fa'

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
  const [readings, setReadings] = useState([]);

  // Filters + sorting state
  const [genreFilter,   setGenreFilter]   = useState([])
  const [countryFilter, setCountryFilter] = useState([])
  const [genderFilter,  setGenderFilter]  = useState([])
  const [sortField,     setSortField]     = useState('title')
  const [sortAsc,       setSortAsc]       = useState(true)

  const [allGenres,    setAllGenres]    = useState([])
  const [allCountries, setAllCountries] = useState([])
  const [allGenders,   setAllGenders]   = useState([])

  const clearAll = () => {
    setGenreFilter([])
    setCountryFilter([])
    setGenderFilter([])
  }

  // headless list-collections for multi-selects & sort
  const genreCollection = useMemo(
    () => createListCollection({ items: allGenres.map(g => ({ label: g, value: g })) }),
    [allGenres]
  )
  const countryCollection = useMemo(
    () => createListCollection({ items: allCountries.map(c => ({ label: c, value: c })) }),
    [allCountries]
  )
  const genderCollection = useMemo(
    () => createListCollection({ items: allGenders.map(g => ({ label: g, value: g })) }),
    [allGenders]
  )
  const sortCollection = useMemo(
    () => createListCollection({
      items: [
        { label: 'Cím',     value: 'title'    },
        { label: 'Megjelenés',   value: 'release_year' },
        { label: 'Oldalszám',     value: 'page_count'   },
      ]
    }),
    []
  )

  // fetch all books
  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author, added_by, is_selected, cover_url, genre, country, author_gender, release_year, page_count')
    if (error) console.error(error)
    else setBooks(data)
  }

  // Fetch the readings
  const fetchReadings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select(`
        date,
        books (
          id, title, author, added_by,
          cover_url, genre, country,
          author_gender, release_year, page_count
        )
      `)
      .order('date', { ascending: false });  // newest first

    if (error) {
      console.error('Failed to load past meetings', error);
    } else {
      setReadings(data);
    }
  };

  useEffect(() => {
    if (user) {
      fetchReadings();
    }
  }, [user]);

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

  useEffect(() => {
    const waitlist = books.filter(b => !b.is_selected)

    // assume each book has .genre: string[] and .country, .author_gender
    setAllGenres(Array.from(new Set(waitlist.flatMap(b => b.genre))).sort())
    setAllCountries(
      Array.from(new Set(waitlist.map(b => b.country).filter(Boolean))).sort()
    )
    setAllGenders(
      Array.from(new Set(waitlist.map(b => b.author_gender).filter(Boolean))).sort()
    )
  }, [books])

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

  //Filter and sort books
  const displayedWaitlist = useMemo(() => {
    let list = books.filter(b => !b.is_selected)

    if (genreFilter.length)
      list = list.filter(b => b.genre.some(g => genreFilter.includes(g)))
    if (countryFilter.length)
      list = list.filter(b => countryFilter.includes(b.country))
    if (genderFilter.length)
      list = list.filter(b => genderFilter.includes(b.author_gender))

    list.sort((a, b) => {
     let va, vb 
     if (sortField === 'title') { 
       va = a.title.toLowerCase() 
       vb = b.title.toLowerCase() 
     } else { 
       // numeric fields: release_year or page_count 
       va = a[sortField] ?? 0 
       vb = b[sortField] ?? 0 
     } 
     if (va < vb) return sortAsc ? -1 : 1 
     if (va > vb) return sortAsc ? 1 : -1 
     return 0 
   })

    return list
  }, [books, genreFilter, countryFilter, genderFilter, sortField, sortAsc])

  return (
    <Box maxW="4xl" mx="auto" mt={6} px={4} overflowX="hidden">
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
              {readings.map(({ date, books: book }) => {
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
                columns={{ base: 2, sm: 3, md: 4, xl: 5 }}
                columnGap={{base: "0", lg:"4"}}
                rowGap="4"
                justifyItems="center"
              >
                {readings.map(({ date, books: book }) => {
                  const meta = userMeta[book.id] || {}
                  return (
                    <Box
                      key={book.id}
                      w={{base: "80%", lg: "100%"}}
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
          <Text fontSize="md" fontWeight="semibold" mb={2}>
            Adj hozzá új könyvet!
          </Text>
          <BookSearchSelector
            onBookClick={b => { setEditBook(b); setAddModalOpen(true) }}
            ref={searchRef}
          />

          <Separator my={4} />
          { /* ───────────── Filters & Sort ───────────── */ }
          <Box mb={4}>
            {/* Desktop filters */}
            <Box display={{ base: 'none', md: 'flex' }} justifyContent="space-between" alignItems="center">
              <HStack spacing={3}>
                {/* Genre */}
                <Select.Root
                  multiple
                  collection={genreCollection}
                  value={genreFilter}
                  onValueChange={e => setGenreFilter(e.value)}
                >
                  <Select.HiddenSelect aria-label="Műfaj" />
                  <Select.Label>Műfaj</Select.Label>
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Műfaj" />
                    </Select.Trigger>
                  </Select.Control>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                    <Select.ClearTrigger onClick={clearAll} />
                  </Select.IndicatorGroup>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content asChild>
                        <Box maxH="200px" overflowY="auto" minW="250px" p={2} bg="white" shadow="md" borderRadius="md">
                          {genreCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                              {item.label}
                              <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Box>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>

                {/* Country */}
                <Select.Root
                  multiple
                  collection={countryCollection}
                  value={countryFilter}
                  onValueChange={e => setCountryFilter(e.value)}
                >
                  <Select.HiddenSelect aria-label="Ország" />
                  <Select.Label>Ország</Select.Label>
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Ország" />
                    </Select.Trigger>
                  </Select.Control>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                    <Select.ClearTrigger onClick={clearAll} />
                  </Select.IndicatorGroup>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content asChild>
                        <Box maxH="200px" overflowY="auto" minW="250px" p={2} bg="white" shadow="md" borderRadius="md">
                          {countryCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                              {item.label}
                              <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Box>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>

                {/* Author gender */}
                <Select.Root
                  multiple
                  collection={genderCollection}
                  value={genderFilter}
                  onValueChange={e => setGenderFilter(e.value)}
                >
                  <Select.HiddenSelect aria-label="Szerző neme" />
                  <Select.Label whiteSpace="nowrap">Szerző neme</Select.Label>
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Szerző neme" />
                    </Select.Trigger>
                  </Select.Control>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                    <Select.ClearTrigger onClick={clearAll} />
                  </Select.IndicatorGroup>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content asChild>
                        <Box maxH="200px" overflowY="auto" minW="250px" p={2} bg="white" shadow="md" borderRadius="md">
                          {genderCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                              {item.label}
                              <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Box>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>

                {/* Clear all filters */}
                <IconButton aria-label="Szűrők törlése" onClick={clearAll} flexShrink={0} mt={6}>
                  <Box position="relative" w="1.5em" h="1.5em">
                    <Box as={FaFilter} boxSize="1.5em" position="absolute" right="0.01em" />
                    <Box as={FaTimes} position="absolute" top="2" right="-1" fontSize="0.6em" color="red.500" />
                  </Box>
                </IconButton>
              </HStack>

              <HStack spacing={2}>
                {/* Asc/Desc */}
                <IconButton
                  aria-label={sortAsc ? 'Növekvő' : 'Csökkenő'}
                  onClick={() => setSortAsc(v => !v)}
                  flexShrink={0}
                  mt={6}
                >
                  {sortAsc ? <FaSortAmountUp/> : <FaSortAmountDown/>}
                </IconButton>

                {/* Sort field */}
                <Select.Root
                  collection={sortCollection}
                  value={[sortField]}
                  onValueChange={e => {
                    const [first='title'] = e.value;
                    setSortField(first);
                  }}
                >
                  <Select.HiddenSelect aria-label="Rendezés" />
                  <Select.Label textAlign="right">Rendezés</Select.Label>
                  <Select.Control>
                    <Select.Trigger><Select.ValueText placeholder="Rendezés" /></Select.Trigger>
                  </Select.Control>
                  <Select.IndicatorGroup>
                    <Select.Indicator/>
                    <Select.ClearTrigger onClick={() => setSortField('title')}/>
                  </Select.IndicatorGroup>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content 
                        asChild
                      >
                        <Box maxH="150px" overflowY="auto" minW="150px" p={2} bg="white" shadow="md" borderRadius="md" position="absolute" right="0">
                          {sortCollection.items.map(item => (
                            <Select.Item key={item.value} item={item}>
                              {item.label}
                              <Select.ItemIndicator><FaCheck/></Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Box>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </Box>

            {/* Mobile icons */}
            <Box display={{ base: 'flex', md: 'none' }}>
              <HStack w="100%" alignItems="center">
                {/* Genre */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                      <IconButton
                          aria-label="Műfaj"
                          variant={genreFilter.length ? 'solid' : 'outline'}
                      >
                          <FaFilter/>
                      </IconButton>
                      </Popover.Trigger>
                  <Popover.Positioner>
                    <Popover.Content
                      maxH="300px"
                      overflowY="auto"
                      w="80vw"
                      p={3}
                      bg="white"
                      shadow="md"
                      borderRadius="md"
                  >
                      <Popover.CloseTrigger asChild>
                          <IconButton aria-label="Bezár" size="sm">
                              <FaTimes/>
                          </IconButton>
                          </Popover.CloseTrigger>
                      <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                      <Popover.Body>
                          <Fieldset.Root>
                              <CheckboxGroup
                              value={genreFilter}
                              onValueChange={setGenreFilter}
                              name="genre"
                              >
                              <Fieldset.Legend fontSize="sm" mb="2">
                                  Műfaj
                              </Fieldset.Legend>
                              <Fieldset.Content>
                                  {allGenres.map(g => (
                                  <Checkbox.Root key={g} value={g}>
                                      <Checkbox.HiddenInput />
                                      <Checkbox.Control />
                                      <Checkbox.Label>{g}</Checkbox.Label>
                                  </Checkbox.Root>
                                  ))}
                              </Fieldset.Content>
                              </CheckboxGroup>
                          </Fieldset.Root>
                          </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Root>
      
                {/* Country */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                      <IconButton aria-label="Ország" variant={countryFilter.length ? 'solid' : 'outline'}>
                          <FaGlobe/>
                      </IconButton>
                      </Popover.Trigger>
                  <Popover.Positioner>
                    <Popover.Content
                      maxH="300px"
                      overflowY="auto"
                      w="80vw"
                      p={3}
                      bg="white"
                      shadow="md"
                      borderRadius="md"
                  >
                      <Popover.CloseTrigger asChild>
                          <IconButton aria-label="Bezár" size="sm">
                              <FaTimes/>
                          </IconButton>
                          </Popover.CloseTrigger>
                      <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                      <Popover.Body>
                          <Fieldset.Root>
                              <CheckboxGroup
                              value={countryFilter}
                              onValueChange={setCountryFilter}
                              name="country"
                              >
                              <Fieldset.Legend fontSize="sm" mb="2">
                                  Ország
                              </Fieldset.Legend>
                              <Fieldset.Content>
                                  {allCountries.map(c => (
                                  <Checkbox.Root key={c} value={c}>
                                      <Checkbox.HiddenInput />
                                      <Checkbox.Control />
                                      <Checkbox.Label>{c}</Checkbox.Label>
                                  </Checkbox.Root>
                                  ))}
                              </Fieldset.Content>
                              </CheckboxGroup>
                          </Fieldset.Root>
                          </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Root>
      
                {/* Gender */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                      <IconButton aria-label="Szerző neme" variant={genderFilter.length ? 'solid' : 'outline'}>
                          <FaVenusMars/>
                      </IconButton>
                      </Popover.Trigger>
                  <Popover.Positioner>
                    <Popover.Content
                      maxH="300px"
                      overflowY="auto"
                      w="80vw"
                      p={3}
                      bg="white"
                      shadow="md"
                      borderRadius="md"
                  >
                      <Popover.CloseTrigger asChild>
                          <IconButton aria-label="Bezár" size="sm">
                              <FaTimes/>
                          </IconButton>
                          </Popover.CloseTrigger>
                      <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                      <Popover.Body>
                          <Fieldset.Root>
                              <CheckboxGroup
                              value={genderFilter}
                              onValueChange={setGenderFilter}
                              name="gender"
                              >
                              <Fieldset.Legend fontSize="sm" mb="2">
                                  Szerző neme
                              </Fieldset.Legend>
                              <Fieldset.Content>
                                  {allGenders.map(g => (
                                  <Checkbox.Root key={g} value={g}>
                                      <Checkbox.HiddenInput />
                                      <Checkbox.Control />
                                      <Checkbox.Label>{g}</Checkbox.Label>
                                  </Checkbox.Root>
                                  ))}
                              </Fieldset.Content>
                              </CheckboxGroup>
                          </Fieldset.Root>
                          </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Root>
      
                {/* Clear All */}
                <IconButton aria-label="Szűrők törlése" onClick={clearAll}>
                      <Box position="relative" w="1.5em" h="1.5em">
                          <Box as={FaFilter} boxSize="1.5em" position="absolute" right="0.01em" />
                          <Box
                              as={FaTimes}
                              position="absolute"
                              top="2"
                              right="-1"
                              fontSize="0.6em"
                              color="red.500"
                          />
                      </Box>
                  </IconButton>
              </HStack>
      
              <HStack spacing={2}>
                {/* Asc/Desc */}
                <IconButton
                  aria-label={sortAsc ? 'Növekvő' : 'Csökkenő'}
                  onClick={() => setSortAsc(v => !v)}
                >
                      {sortAsc ? <FaSortAmountUp /> : <FaSortAmountDown />}
                </IconButton>
                {/* Sort */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                      <IconButton aria-label="Rendezés">
                          <FaSort/>
                      </IconButton>
                  </Popover.Trigger>
                  <Popover.Positioner>
                    <Popover.Content>
                      <Popover.CloseTrigger asChild>
                      <IconButton aria-label="Bezár" size="sm">
                          <FaTimes/>
                      </IconButton>
                      </Popover.CloseTrigger>
                      <Popover.Arrow><Popover.ArrowTip/></Popover.Arrow>
                      <Popover.Body>
                        <Popover.Title mb={2} fontWeight={"bold"}>Rendezés</Popover.Title>
                        <RadioGroup.Root
                          value={sortField}
                          onValueChange={details  => setSortField(details.value)}
                          >
                          <HStack gap="4">
                              {sortCollection.items.map(item => (
                              <RadioGroup.Item key={item.value} value={item.value}>
                                  <RadioGroup.ItemHiddenInput />
                                  <RadioGroup.ItemIndicator />
                                  <RadioGroup.ItemText>{item.label}</RadioGroup.ItemText>
                              </RadioGroup.Item>
                              ))}
                          </HStack>
                          </RadioGroup.Root>
                      </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Popover.Root>
              </HStack>
            </Box>
          </Box>

          <VStack spacing={4} mt={6} align="stretch">
            {displayedWaitlist.map(book => ( 
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
                  {(book.added_by === user.user_metadata.display_name || isAdmin) && (
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
                                <Popover.Title fontSize="md" fontWeight="bold" color="red.800">
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
                  )}
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
