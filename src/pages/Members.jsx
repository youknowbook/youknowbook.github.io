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

export default function Members() {
  const [members, setMembers] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)

  useEffect(() => {
    async function loadMembers() {
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, profile_picture, motto, favourite_books')
      if (error) console.error('Hiba a tagok betöltésekor:', error)
      else setMembers(data)
    }
    loadMembers()
  }, [])

  const handleBookClick = (book) => setSelectedBook(book)
  const closePopover = () => setSelectedBook(null)

  return (
    <VStack spacing={6} align="stretch" maxW="4xl" mx="auto" mt={6} px={{ base: 2, md: 6 }}>
      {members.map(member => (
        <Stack
          key={member.id}
          p={4}
          bg="white"
          boxShadow="sm"
          borderRadius="md"
          direction={{ base: 'column', md: 'row' }}
          spacing={{ base: 4, md: 6 }}
          align={{ base: 'center', md: 'start' }}
        >
          {/* Avatar + Name + Motto */}
          <Box w={{ base: 'full', md: '140px' }}>
            <Stack direction={{ base: 'row', md: 'column' }} spacing={{ base: 2, md: 2 }} align="center">
              <AvatarGroup>
                <Avatar.Root size={{ base: 'md', md: '2xl' }}>
                  <Avatar.Fallback name={member.display_name} />
                  {member.profile_picture ? <Avatar.Image src={member.profile_picture} /> : null}
                </Avatar.Root>
              </AvatarGroup>
              <VStack align={{ base: 'start', md: 'center' }} spacing={1}>
                <Text fontWeight="bold" fontSize={{ base: 'sm', md: 'lg' }}>{member.display_name}</Text>
                <Text textAlign={"center"} fontSize={{ base: 'xx-small', md: 'sm' }} color="gray.600">{member.motto}</Text>
              </VStack>
            </Stack>
          </Box>
          {/* Favourite book covers - always horizontal */}
          <Box flex="1" w="full">
            <HStack
              spacing={{ base: 2, md: 4 }}
              justify={{ base: 'center', sm: 'space-between' }}
              overflowX={{ base: 'auto', sm: 'visible' }}
              py={2}
              px={{ base: 2, sm: 0 }}
              css={{
                '&::-webkit-scrollbar': { height: '6px' },
                '&::-webkit-scrollbar-thumb': { background: '#CBD5E0', borderRadius: '3px' }
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
                  onClick={() => handleBookClick(book)}
                  boxShadow="md"
                >
                  <Image
                    src={book.cover || null}
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
      ))}
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
