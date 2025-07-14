import React, { useEffect, useState } from 'react'
import {
  Box,
  VStack,
  HStack,
  Stack,
  Image,
  Text,
  AvatarGroup,
  Button
} from '@chakra-ui/react'
import { Avatar } from '@chakra-ui/react'
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
            {/* n. Szint badge */}
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

      {/* Favourite book covers */}
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
          {member.favourite_books?.slice(0, 4).map(book => (
            <Box
              key={book.key}
              flex="0 0 auto"
              w={{ base: '60px', sm: '80px' }}
              h={{ base: '90px', sm: '120px' }}
              overflow="hidden"
              borderRadius="md"
              cursor="pointer"
              onClick={() => onBookClick(book)}
              boxShadow="md"
            >
              <Image
                src={book.cover || ''}
                alt={book.title}
                w="100%"
                h="100%"
                objectFit="cover"
              />
            </Box>
          ))}
        </HStack>
      </Box>
    </Stack>
  )
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [meetings, setMeetings] = useState([]);
  const admins  = members.filter(m => m.is_admin);
  const regular = members.filter(m => !m.is_admin);

  useEffect(() => {
    async function loadMembers() {
      const { data, error } = await supabase
        .from('users')
        .select('id, is_admin, display_name, profile_picture, motto, favourite_books')
      if (error) console.error('Hiba a tagok betöltésekor:', error)
      else setMembers(data)
    }
    loadMembers()
  }, [])

  // once on mount, fetch all meetings (id, is_active, attendees)
  useEffect(() => {
    async function loadMeetings() {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, is_active, attendees')
      if (error) {
        console.error('Failed to load meetings:', error)
      } else {
        setMeetings(data)
      }
    }
    loadMeetings()
  }, [])

  // helper to count how many past (is_active=false) meetings
  function countPast(memberId) {
    return meetings.filter(
      m =>
        m.is_active === false &&
        Array.isArray(m.attendees) &&
        m.attendees.includes(memberId)
    ).length
  }

  const handleBookClick = (book) => setSelectedBook(book)
  const closePopover = () => setSelectedBook(null)

  return (
    <VStack spacing={6} align="stretch" maxW="4xl" mx="auto" mt={6} px={{ base: 2, md: 6 }}>
      {/* Adminok */}
      <Box>
        <Text fontSize="lg" mb={2}>Adminok ({admins.length})</Text>
        <VStack spacing={6} align="stretch">
          {admins.map(m => (
            <MemberCard key={m.id} member={m} onBookClick={handleBookClick} attendedCount={countPast(m.id)} />
          ))}
        </VStack>
      </Box>

      {/* Tagok */}
      <Box mt={8}>
        <Text fontSize="lg" mb={2}>Tagok ({regular.length})</Text>
        <VStack spacing={6} align="stretch">
          {regular.map(m => (
            <MemberCard key={m.id} member={m} onBookClick={handleBookClick} attendedCount={countPast(m.id)} />
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
