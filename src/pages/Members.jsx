import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Stack,
  Image,
  Text,
  AvatarGroup,
  Button,
  IconButton,
  Select,
  Portal,
  createListCollection,
} from '@chakra-ui/react'
import { Avatar } from '@chakra-ui/react'
import { FaSortAmountUp, FaSortAmountDown, FaCheck } from 'react-icons/fa'
import { createPortal } from 'react-dom'
import { supabase } from '../api/supabaseClient'

function MemberCard({ member, onBookClick, attendedCount }) {
  return (
    <Stack
      p={4}
      bg="white"
      boxShadow="sm"
      borderRadius="md"
      direction={{ base: 'column', md: 'row' }}
      spacing={{ base: 4, md: 6 }}
      align={{ base: 'center', md: 'start' }}
    >
      {/* Avatar + Name + Motto + past‐meetings badge */}
      <Box w={{ base: 'full', md: '140px' }}>
        <Stack
          direction={{ base: 'row', md: 'column' }}
          spacing={2}
          align="center"
          position="relative"
        >
          <AvatarGroup>
            {/* keep exactly as you had it */}
            <Avatar.Root size={{ base: 'md', md: '2xl' }}>
              <Avatar.Fallback name={member.display_name} />
              {member.profile_picture && (
                <Avatar.Image src={member.profile_picture} />
              )}
            </Avatar.Root>
          </AvatarGroup>

          <VStack align={{ base: 'start', md: 'center' }} spacing={1}>
            <Text fontWeight="bold" fontSize={{ base: 'sm', md: 'lg' }}>
              {member.display_name}
            </Text>
            <Box
              position={{ base: 'absolute', md: 'static' }}
              top={{ base: 1, md: 'auto' }}
              right={{ base: 2, md: 'auto' }}
              bg="blue.100"
              px={2}
              py={0.5}
              borderRadius="full"
              fontSize="xs"
              fontWeight="semibold"
            >
              {attendedCount}. Szint
            </Box>
            <Text
              textAlign="center"
              fontSize={{ base: 'xx-small', md: 'sm' }}
              color="gray.600"
            >
              {member.motto}
            </Text>
          </VStack>
        </Stack>
      </Box>

      {/* Favourite book covers (4 slots with placeholders) */}
      <Box flex="1" w="full">
        <HStack
          spacing={{ base: 2, md: 4 }}
          justify={{ base: 'center', sm: 'space-between' }}
          overflowX={{ base: 'auto', sm: 'visible' }}
          py={2}
          px={{ base: 2, sm: 0 }}
          css={{
            '&::-webkit-scrollbar': { height: '6px' },
            '&::-webkit-scrollbar-thumb': {
              background: '#CBD5E0',
              borderRadius: '3px'
            }
          }}
        >
          {Array.from({ length: 4 }, (_, i) => member.favourite_books?.[i] ?? null).map((book, idx) => {
            const hasBook = !!book
            const cover   = hasBook ? (book.cover || '') : ''
            const title   = hasBook ? (book.title || 'Kedvenc könyv') : 'Adj hozzá kedvencet'
            const key     = hasBook ? (book.key || `${title}-${idx}`) : `placeholder-${idx}`

            return (
              <Box
                key={key}
                flex="0 0 auto"
                w={{ base: '60px', sm: '80px' }}
                h={{ base: '90px', sm: '120px' }}
                overflow="hidden"
                borderRadius="md"
                boxShadow="md"
                bg="gray.100"
                position="relative"
                cursor={hasBook ? 'pointer' : 'default'}
                onClick={hasBook ? () => onBookClick(book) : undefined}
              >
                {/* Fallback text sits behind the image; becomes visible if there's no cover or the image fails */}
                <Box
                  position="absolute"
                  inset={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  px={2}
                  textAlign="center"
                  zIndex={0}
                >
                  <Text fontSize="xs" color="gray.600" noOfLines={3}>
                    {cover ? '' : title}
                    {!cover && hasBook ? <>&nbsp;<br/>Nincs borító</> : null}
                    {!hasBook ? '—' : null}
                  </Text>
                </Box>

                {cover && (
                  <Image
                    src={cover}
                    alt={title}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    zIndex={1}
                    onError={(e) => {
                      // hide the broken image so the fallback text shows through
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </Box>
            )
          })}
        </HStack>
      </Box>
    </Stack>
  )
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)

  // arrange state (use headless Select skeleton like Waitlist)
  const [sortField, setSortField] = useState('level') // 'level' | 'display_name' | 'created_at'
  const [sortAsc, setSortAsc] = useState(false)       // default: level desc

  // collections for Select
  const sortCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: 'Szint',         value: 'level' },
          { label: 'Név',           value: 'display_name' },
          { label: 'Regisztráció',  value: 'created_at' },
        ],
      }),
    []
  )

  // after sortCollection
  const longestSortLabel = useMemo(
    () => sortCollection.items.reduce((max, it) => it.label.length > max ? it.label.length : max, 0),
    [sortCollection]
  )

  // rough width in ch + padding for icon/chevron; tweak the +4 if needed
  const sortTriggerMinCh = Math.max(longestSortLabel + 4, 12)

  // base groups (kept)
  const admins  = members.filter(m => m.is_admin)
  const regular = members.filter(m => !m.is_admin)

  // get auth user
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!error && data?.user) setCurrentUserId(data.user.id)
    })()
  }, [])

  useEffect(() => {
    async function loadMembers() {
      const { data, error } = await supabase
        .from('users')
        .select('id, is_admin, display_name, profile_picture, motto, favourite_books, auth_created_at')
      if (error) console.error('Hiba a tagok betöltésekor:', error)
      else setMembers(data || [])
    }
    loadMembers()
  }, [])

  useEffect(() => {
    async function loadMeetings() {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, is_active, attendees')
      if (error) console.error('Failed to load meetings:', error)
      else setMeetings(data || [])
    }
    loadMeetings()
  }, [])

  // helper to count past (inactive) meeting attendance
  function countPast(memberId) {
    return meetings.filter(
      m =>
        m.is_active === false &&
        Array.isArray(m.attendees) &&
        m.attendees.includes(memberId)
    ).length
  }

  // level map for sorting & badges
  const levelById = useMemo(() => {
    const map = new Map()
    for (const m of members) map.set(m.id, countPast(m.id))
    return map
  }, [members, meetings])

  // sorting util
  const sortList = (list) => {
    const copy = [...list]
    copy.sort((a, b) => {
      let va, vb
      if (sortField === 'display_name') {
        va = (a.display_name || '').toLowerCase()
        vb = (b.display_name || '').toLowerCase()
        const cmp = va.localeCompare(vb, 'hu')
        return sortAsc ? cmp : -cmp
      }
      if (sortField === 'created_at') {
        va = new Date(a.auth_created_at || 0).getTime()
        vb = new Date(b.auth_created_at || 0).getTime()
        const cmp = va - vb // older first
        return sortAsc ? cmp : -cmp
      }
      // level
      va = levelById.get(a.id) ?? 0
      vb = levelById.get(b.id) ?? 0
      const cmp = va - vb
      return sortAsc ? cmp : -cmp // default desc when sortAsc=false
    })
    return copy
  }

  // prepare lists; put current user at the top within their own section
  const me = members.find(m => m.id === currentUserId) || null

  const adminsSorted  = sortList(admins.filter(m => m.id !== currentUserId))
  const regularSorted = sortList(regular.filter(m => m.id !== currentUserId))

  // insert me at top of the proper section
  const adminsShown  = me?.is_admin ? [me, ...adminsSorted] : adminsSorted
  const regularShown = me && !me.is_admin ? [me, ...regularSorted] : regularSorted

  const handleBookClick = (book) => setSelectedBook(book)
  const closePopover = () => setSelectedBook(null)

  return (
    <VStack spacing={6} align="stretch" maxW="4xl" mx="auto" mt={6} px={{ base: 2, md: 6 }}>
      {/* Arrange (same headless Select skeleton style) */}
      <HStack justify="space-between" align="center">
        <Text fontSize="xl" fontWeight="bold">Tagok</Text>

        <HStack spacing={2}>
          <IconButton
            aria-label={sortAsc ? 'Növekvő' : 'Csökkenő'}
            onClick={() => setSortAsc(v => !v)}
            flexShrink={0}
          >
            {sortAsc ? <FaSortAmountUp/> : <FaSortAmountDown/>}
          </IconButton>

          <Select.Root
            collection={sortCollection}
            value={[sortField]}
            onValueChange={(e) => {
              const [first = 'level'] = e.value
              setSortField(first)
            }}
          >
            <Select.HiddenSelect aria-label="Rendezés" />
            <Select.Label srOnly>Rendezés</Select.Label>

            <Select.Control>
              <Select.Trigger
                // prevent shrinking on small screens
                flexShrink={0}
                // auto width, but ensure room for the longest option text
                w="auto"
                minW={`calc(${sortTriggerMinCh}ch)`}
                // keep label on one line
                whiteSpace="nowrap"
                // optional: a little breathing room
                px={3}
                py={1.5}
              >
                <Select.ValueText whiteSpace="nowrap" />
              </Select.Trigger>
            </Select.Control>

            <Select.IndicatorGroup>
              <Select.Indicator />
              <Select.ClearTrigger onClick={() => setSortField('level')} />
            </Select.IndicatorGroup>

            <Portal>
              <Select.Positioner
                // keep the popup inside the viewport and align to the trigger's right edge
                positioning={{
                  placement: 'bottom-end',
                  gutter: 6,
                  // prevents hanging off-screen on mobile
                  flip: true,
                  overflowPadding: 8,
                }}
              >
                <Select.Content asChild>
                  <Box
                    // match or exceed trigger width so items don’t wrap or truncate
                    minW={{ base: `calc(${sortTriggerMinCh}ch)`, md: '200px' }}
                    // never exceed viewport width on phones
                    maxW="calc(100vw - 16px)"
                    maxH="150px"
                    overflowY="auto"
                    p={2}
                    bg="white"
                    shadow="md"
                    borderRadius="md"
                  >
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
      </HStack>

      {/* Adminok */}
      <Box>
        <Text fontSize="lg" mb={2}>Adminok ({adminsShown.length})</Text>
        <VStack spacing={6} align="stretch">
          {adminsShown.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              onBookClick={handleBookClick}
              attendedCount={levelById.get(m.id) ?? 0}
            />
          ))}
        </VStack>
      </Box>

      {/* Tagok */}
      <Box mt={8}>
        <Text fontSize="lg" mb={2}>Tagok ({regularShown.length})</Text>
        <VStack spacing={6} align="stretch">
          {regularShown.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              onBookClick={handleBookClick}
              attendedCount={levelById.get(m.id) ?? 0}
            />
          ))}
        </VStack>
      </Box>

      {/* Book info popover */}
      {selectedBook && createPortal(
        <Box pos="fixed" inset={0} bg="blackAlpha.600" zIndex={1000} display="flex" alignItems="center" justifyContent="center" onClick={closePopover}>
          <Box bg="white" p={{ base: 4, md: 6 }} borderRadius="md" boxShadow="lg" minW={{ base: '80%', sm: 'sm', md: 'xs' }} onClick={e => e.stopPropagation()}>
            <Text fontSize="lg" fontWeight="bold" mb={2}>{selectedBook.title}</Text>
            <Text fontSize="md" color="gray.700">{selectedBook.author}</Text>
            <Button mt={4} onClick={closePopover}>Bezárás</Button>
          </Box>
        </Box>, document.body
      )}
    </VStack>
  )
}
