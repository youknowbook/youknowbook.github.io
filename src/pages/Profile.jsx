import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Input,
  Text,
  Button,
  Image,
  VStack,
  Heading,
  Separator,
  Flex,
  SimpleGrid,
  Avatar,
  AvatarFallback,
  AspectRatio 
} from '@chakra-ui/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../api/supabaseClient'
import BookSearchSelector from '../components/Books/BookSearchSelector'

export default function Profile() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [motto, setMotto] = useState('')
  const [profilePic, setProfilePic] = useState('')
  const [favouriteBooks, setFavouriteBooks] = useState([])
  const [saveFeedback, setSaveFeedback] = useState('')
  const [uploadFeedback, setUploadFeedback] = useState('')
  const [maxReachedFeedback, setMaxReachedFeedback] = useState(false)
  const fileInputRef = useRef(null)

  // Load profile data
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) {
        console.error('❌ Profil betöltése sikertelen:', error)
        return
      }

      setDisplayName(data.display_name || '')
      setMotto(data.motto || '')
      setProfilePic(data.profile_picture || '')
      setFavouriteBooks(
        (Array.isArray(data.favourite_books) ? data.favourite_books : []).map(b => ({
          ...b,
          cover: b.cover || ''
        }))
      )
    }
    if (user) fetchProfile()
  }, [user])

  // Upload profile picture
  const handleProfilePicUpload = async e => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage
      .from('book-covers')
      .upload(path, file)
    if (uploadErr) {
      console.error('❌ Profile feltöltése sikertelen:', uploadErr)
      setUploadFeedback('❌ Profilkép feltöltése sikertelen.')
      return
    }
    const { data: urlData } = supabase.storage
      .from('book-covers')
      .getPublicUrl(path)
    setProfilePic(urlData.publicUrl)
  }

  // Add a favorite book (with cover)
  const handleAddBook = book => {
    if (favouriteBooks.length >= 4) return;

    console.log("📚 Book selected:", book);
    const simplified = {
      // if you use Google Books API, `book.id` is the unique key
      key: book.key || book.id || "",

      // title often lives at book.title or book.volumeInfo.title
      title:
        book.title ||
        book.volumeInfo?.title ||
        "No title available",

      // authors is an array; join into a string (or pick the first one)
      author:
        book.author ||
        (Array.isArray(book.volumeInfo?.authors)
          ? book.volumeInfo.authors.join(", ")
          : "Unknown author"),

      // thumbnail is under volumeInfo.imageLinks
      cover:
        book.cover_url ||
        book.volumeInfo?.imageLinks?.thumbnail ||
        ""
    };

    // prevent duplicates
    if (favouriteBooks.some(b => b.key === simplified.key)) return;

    setFavouriteBooks(prev => {
      const next = [...prev, simplified];
      if (next.length === 4) {
        setMaxReachedFeedback(true);
        setTimeout(() => setMaxReachedFeedback(false), 3000);
      }
      return next;
    });
  };

  const handleRemoveBook = target => {
    setFavouriteBooks(prev => prev.filter(b => b.key !== target.key))
  }

  // Save profile
  const handleSave = async () => {
    const sanitizedBooks = favouriteBooks.map(b => ({
      title:  b.title || '',
      author: b.author || '',
      key:    b.key || '',
      cover:  b.cover || ''
    }))

    const { error } = await supabase
      .from('users')
      .update({
        display_name:    displayName,
        motto,
        profile_picture: profilePic,
        favourite_books: sanitizedBooks
      })
      .eq('id', user.id)

    if (error) {
      console.error('❌ Profil mentése sikertelen:', error)
      setSaveFeedback('❌ Profil mentése sikertelen.')
    } else {
      setSaveFeedback('✅ Profil mentve!')
      setTimeout(() => setSaveFeedback(''), 3000)
    }
  }

  return (
    <Box maxW="lg" mx="auto" mt={10} px={4}>
      <Heading mb={6}>A profilom</Heading>

      <Flex gap={6} alignItems="center">
          <Box
            position="relative"
            flexShrink={0}
            cursor="pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <AspectRatio ratio={1} w={{ base: '120px', sm: '150px' }}>
              {profilePic ? (
                <Image
                  src={profilePic}
                  alt="Profile"
                  objectFit="cover"
                  borderRadius="md"
                />
              ) : (
                <Box
                  bg="gray.200"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={{ base: '3xl', sm: '5xl' }} fontWeight="bold">
                    {displayName?.charAt(0).toUpperCase()}
                  </Text>
                </Box>
              )}
            </AspectRatio>

            <Box
              position="absolute"
              bottom={0}
              w="100%"
              bg="blackAlpha.600"
              color="white"
              textAlign="center"
              fontSize="sm"
              py={2}
              borderBottomRadius="md"
            >
              Töltsd fel a profilképed!
            </Box>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleProfilePicUpload}
            />
          </Box>

        <VStack align="start" spacing={2} flexGrow={1}>
          <Text>A nevem:</Text>
          <Input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
          />
          <Text>Jelmondat/idézet:</Text>
          <Input
            value={motto}
            onChange={e => setMotto(e.target.value)}
          />
        </VStack>
      </Flex>

      <VStack spacing={4} align="stretch" mt={8}>
        <Separator />

        <Text>Kedvenc könyveim (maximum 4):</Text>

        <Box
          opacity={favouriteBooks.length >= 4 ? 0.5 : 1}
          pointerEvents={favouriteBooks.length >= 4 ? 'none' : 'auto'}
        >
          <BookSearchSelector
            onBookClick={handleAddBook}
            disableIf={book =>
              favouriteBooks.length >= 4 ||
              favouriteBooks.some(b => b.key === book.key)
            }
          />
        </Box>

        {maxReachedFeedback && (
          <Text color="red.500" fontSize="sm">
            Kiválasztottál 4 kedvenc könyvet!
          </Text>
        )}

        <SimpleGrid
          columns={{ base: 2, sm: 4 }}
          columnGap={{ base: 2, sm: 4 }}
          rowGap={{ base: 6, sm: 4 }}
          justifyItems="center"
        >
          {favouriteBooks.map(b => (
            <Box key={b.key} position="relative">
              {b.cover ? (
                <Image
                  src={b.cover}
                  w="80px"
                  h="120px"
                  objectFit="cover"
                  borderRadius="md"
                />
              ) : (
                <Box
                  w="80px"
                  h="120px"
                  bg="gray.200"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  textAlign="center"
                  p={2}
                >
                  <VStack spacing={1}>
                    <Text noOfLines={2} fontSize="xs">
                      {b.title}
                    </Text>
                    <Text fontSize="xx-small" color="gray.600">
                      Borítókép feltöltése
                    </Text>
                  </VStack>
                </Box>
              )}

              <Input
                type="file"
                accept="image/*"
                position="absolute"
                top={0}
                left={0}
                w="80px"
                h="120px"
                opacity={0}
                cursor="pointer"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  // sanitize filename: strip accents, replace unsafe chars with _
                  const rawName = file.name.normalize('NFKD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^\w.\-]/g, '_')

                  const key = `${user.id}/favs/${b.key}_${Date.now()}_${rawName}`
                  const { error: uploadErr } = await supabase.storage
                    .from('book-covers')
                    .upload(key, file)
                  if (uploadErr) {
                    console.error('❌ Borítókép feltöltése meghiúsult:', uploadErr)
                    setUploadFeedback(`❌ Borítókép feltöltése meghiúsult: ${uploadErr.message}`)
                    return
                  }

                  const { data: urlData, error: urlErr } = await supabase.storage
                    .from('book-covers')
                    .getPublicUrl(key)
                  if (urlErr) {
                    console.error('❌ Nem találom az URL-t:', urlErr)
                    setUploadFeedback(`❌  Nem találom az URL-t: ${urlErr.message}`)
                    return
                  }

                  setUploadFeedback('✅ Borítókép feltöltve!')
                  setTimeout(() => setUploadFeedback(''), 3000)

                  const publicUrl = urlData.publicUrl
                  setFavouriteBooks(prev =>
                    prev.map(x =>
                      x.key === b.key ? { ...x, cover: publicUrl } : x
                    )
                  )
                }}
              />


              <Button
                size="2xs"
                borderRadius="full"
                bg="red.500"
                color="white"
                position="absolute"
                top={1}
                right={1}
                _hover={{ bg: 'red.600' }}
                onClick={() => handleRemoveBook(b)}
              >
                ×
              </Button>
            </Box>
          ))}
        </SimpleGrid>

        <Button colorScheme="green" onClick={handleSave}>
          Profilom mentése
        </Button>

        {saveFeedback && (
          <Text
            fontSize="sm"
            color={saveFeedback.startsWith('✅') ? 'green.500' : 'red.500'}
          >
            {saveFeedback}
          </Text>
        )}

        {uploadFeedback && (
          <Text fontSize="sm" color="red.500">
            {uploadFeedback}
          </Text>
        )}
      </VStack>
    </Box>
  )
}
