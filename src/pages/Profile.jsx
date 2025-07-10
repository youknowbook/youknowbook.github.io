import {
  Box,
  Button,
  Input,
  VStack,
  Heading,
  Text,
  Image,
  Separator,
  Flex
} from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../api/supabaseClient'
import BookSearchSelector from '../components/Books/BookSearchSelector'

export default function Profile() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [motto, setMotto] = useState('')
  const [profilePic, setProfilePic] = useState('')
  const [favouriteBooks, setFavouriteBooks] = useState([])
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
        console.error("❌ Failed to fetch profile:", error)
        return
      }

      setDisplayName(data.display_name || '')
      setMotto(data.motto || '')
      setProfilePic(data.profile_picture || '')
      setFavouriteBooks(
        Array.isArray(data.favourite_books) ? data.favourite_books : []
      )
    }

    if (user) fetchProfile()
  }, [user])

  // Upload image to Supabase
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    const filePath = `${user.id}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file)

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message)
      return
    }

    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath)

    const publicUrl = urlData?.publicUrl
    setProfilePic(publicUrl)
  }

  // Handle saving profile
  const handleSave = async () => {
    const sanitizedBooks = favouriteBooks.map((b) => ({
      title: b.title || '',
      author: b.author || '',
      key: b.key || '',
    }))

    const { error } = await supabase
      .from('users')
      .update({
        display_name: displayName,
        motto,
        profile_picture: profilePic,
        favourite_books: sanitizedBooks,
      })
      .eq('id', user.id)

    if (error) {
      console.error('❌ Failed to save profile:', error.message)
    } else {
      console.log('✅ Profile saved.')
    }
  }

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    const filePath = `${user.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file)

    if (error) {
      console.error('Failed to upload profile picture:', error.message)
      return
    }

    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath)

    setProfilePic(data?.publicUrl || '')
  }


  const handleAddBook = (book) => {
    if (favouriteBooks.length >= 4) return
    const simplified = {
      title: book.title,
      author: book.author_name?.[0] || book.author || 'Unknown',
      key: book.key,
    }
    if (!favouriteBooks.some(b => b.key === simplified.key)) {
      setFavouriteBooks(prev => [...prev, simplified])
    }
  }

  const handleRemoveBook = (target) => {
    setFavouriteBooks(prev => prev.filter(b => b.key !== target.key))
  }

  return (
    <Box maxW="lg" mx="auto" mt={10}>
      <Heading mb={6}>Your Profile</Heading>
      <Flex gap={6} alignItems="center">
        <Box position="relative" boxSize="150px" flexShrink={0}>
          <Image
            src={profilePic || 'https://axgruqqfgmuvrhdvcgwj.supabase.co/storage/v1/object/public/profile-pictures//default-avatar-icon-of-social-media-user-vector.jpg'}
            alt="Profile"
            boxSize="100%"
            objectFit="cover"
            borderRadius="md"
          />
          <Box
            position="absolute"
            bottom={0}
            w="100%"
            bg="blackAlpha.600"
            color="white"
            textAlign="center"
            fontSize="sm"
            py={1}
            cursor="pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            Change Profile Picture
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
          <Text>Display Name:</Text>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Text>Motto:</Text>
          <Input value={motto} onChange={(e) => setMotto(e.target.value)} />
        </VStack>
      </Flex>

      <VStack spacing={4} align="stretch">
        <Separator my={4} />

        <Text>Favorite Books (max 4):</Text>
        <BookSearchSelector
          onBookClick={handleAddBook}
          disableIf={(book) =>
            favouriteBooks.length >= 4 ||
            favouriteBooks.some((b) => b.key === book.key)
          }
        />

        <Box display="flex" flexWrap="wrap" gap={2}>
          {favouriteBooks.map((book) => (
            <Box
              key={book.key}
              px={3}
              py={1}
              bg="gray.100"
              borderRadius="full"
              display="flex"
              alignItems="center"
            >
              <Text>{book.title}</Text>
              <Button
                size="xs"
                ml={2}
                onClick={() => handleRemoveBook(book)}
                variant="ghost"
                fontSize="sm"
                px={1}
                aria-label="Remove"
              >
                ×
              </Button>
            </Box>
          ))}
        </Box>

        <Button colorScheme="green" onClick={handleSave}>
          Save Profile
        </Button>
      </VStack>
    </Box>
  )
}
