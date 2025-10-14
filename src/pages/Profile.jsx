import React, { useState, useEffect, useRef } from 'react'
import {
  Box, Input, Text, Button, Image, VStack, Heading, Separator,
  Flex, SimpleGrid, AspectRatio, HStack,
} from '@chakra-ui/react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../api/supabaseClient'
import BookSearchSelector from '../components/Books/BookSearchSelector'

// Shared: sanitize books
const sanitizeBooks = (arr = []) => (arr || []).map(b => ({
  title:  b?.title  || '',
  author: b?.author || '',
  key:    b?.key    || '',
  cover:  b?.cover  || ''
}))

// Robust fetch that seeds if missing (mirrors AuthContext)
async function getOrSeedProfile(user) {
  const { data: row } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (row) return row

  const seed = {
    id: user.id,
    display_name: null,
    motto: '',
    profile_picture: '',
    favourite_books: [],
    auth_created_at: user.created_at || new Date().toISOString(),
    is_admin: false,
  }
  const { data: seeded, error } = await supabase
    .from('users')
    .insert(seed)
    .select()
    .single()
  if (error) throw error
  return seeded
}

export default function Profile() {
  const { user } = useAuth()

  const [savedDisplayName, setSavedDisplayName] = useState('')
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [nameFeedback, setNameFeedback] = useState('')
  const [nameError, setNameError] = useState('')

  const [motto, setMotto] = useState('')
  const [mottoFeedback, setMottoFeedback] = useState('')

  const [profilePic, setProfilePic] = useState('')
  const [favouriteBooks, setFavouriteBooks] = useState([])
  const [uploadFeedback, setUploadFeedback] = useState('')
  const [maxReachedFeedback, setMaxReachedFeedback] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const data = await getOrSeedProfile(user)
        const dn = data?.display_name || ''
        setSavedDisplayName(dn)
        setDisplayNameDraft(dn)
        setMotto(data?.motto || '')
        setProfilePic(data?.profile_picture || '')
        setFavouriteBooks(
          (Array.isArray(data?.favourite_books) ? data.favourite_books : []).map(b => ({ ...b, cover: b.cover || '' }))
        )
      } catch (e) {
        console.error('❌ Profil betöltése sikertelen:', e)
      }
    })()
  }, [user])

  // ---- persistence helpers (UPDATE, not partial UPSERT) ----
  const persistFavouriteBooks = async (next) => {
    const sanitized = sanitizeBooks(next)
    const { error } = await supabase
      .from('users')
      .update({ favourite_books: sanitized })
      .eq('id', user.id)
    if (error) {
      console.error('❌ Kedvencek mentése sikertelen:', error)
      setUploadFeedback('❌ Kedvencek mentése sikertelen.')
    }
  }

  const saveDisplayName = async () => {
    const trimmed = displayNameDraft.trim()
    if (trimmed.length < 2) {
      setNameError('Minimum 2 karakter.')
      return
    }

    // First try UPDATE (row should exist)
    const { error } = await supabase
      .from('users')
      .update({ display_name: trimmed })
      .eq('id', user.id)

    // If somehow no row, fallback to UPSERT with a full, safe payload
    if (error?.code === 'PGRST116' || error?.message?.includes('0 rows')) {
      const full = {
        id: user.id,
        display_name: trimmed,
        motto: motto ?? '',
        profile_picture: profilePic ?? '',
        favourite_books: sanitizeBooks(favouriteBooks),
      }
      const { error: upErr } = await supabase
        .from('users')
        .upsert(full, { onConflict: 'id' })
      if (upErr) {
        console.error('❌ Név mentése sikertelen (upsert):', upErr)
        setNameFeedback('❌ Név mentése sikertelen.')
        return
      }
    } else if (error) {
      console.error('❌ Név mentése sikertelen:', error)
      setNameFeedback('❌ Név mentése sikertelen.')
      return
    }

    setSavedDisplayName(trimmed)
    setNameFeedback('✅ Név mentve!')
    setTimeout(() => setNameFeedback(''), 2500)
  }

  const saveMotto = async () => {
    const { error } = await supabase
      .from('users')
      .update({ motto })
      .eq('id', user.id)

    if (error) {
      // robust fallback with full payload
      const full = {
        id: user.id,
        display_name: savedDisplayName || null,
        motto: motto ?? '',
        profile_picture: profilePic ?? '',
        favourite_books: sanitizeBooks(favouriteBooks),
      }
      const { error: upErr } = await supabase.from('users').upsert(full, { onConflict: 'id' })
      if (upErr) {
        console.error('❌ Motto mentése sikertelen:', upErr)
        setMottoFeedback('❌ Motto mentése sikertelen.')
        return
      }
    }

    setMottoFeedback('✅ Motto mentve!')
    setTimeout(() => setMottoFeedback(''), 2500)
  }

  // ---- uploads / favourites (auto-save) ----
  const handleProfilePicUpload = async e => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const path = `${user.id}/${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('book-covers').upload(path, file)
    if (uploadErr) {
      console.error('❌ Profilkép feltöltése sikertelen:', uploadErr)
      setUploadFeedback('❌ Profilkép feltöltése sikertelen.')
      return
    }
    const { data: urlData } = supabase.storage.from('book-covers').getPublicUrl(path)
    const publicUrl = urlData.publicUrl
    setProfilePic(publicUrl)

    const { error } = await supabase
      .from('users')
      .update({ profile_picture: publicUrl })
      .eq('id', user.id)

    if (error) {
      // fallback to full upsert if needed
      const full = {
        id: user.id,
        display_name: savedDisplayName || null,
        motto: motto ?? '',
        profile_picture: publicUrl,
        favourite_books: sanitizeBooks(favouriteBooks),
      }
      await supabase.from('users').upsert(full, { onConflict: 'id' })
    }
  }

  const handleAddBook = book => {
    if (favouriteBooks.length >= 4) return
    const simplified = {
      key:    book.key || book.id || '',
      title:  book.title || book.volumeInfo?.title || 'No title available',
      author: book.author || (Array.isArray(book.volumeInfo?.authors) ? book.volumeInfo.authors.join(', ') : 'Unknown author'),
      cover:  book.cover_url || book.volumeInfo?.imageLinks?.thumbnail || ''
    }
    if (favouriteBooks.some(b => b.key === simplified.key)) return
    const next = [...favouriteBooks, simplified]
    setFavouriteBooks(next)
    persistFavouriteBooks(next)
    if (next.length === 4) {
      setMaxReachedFeedback(true)
      setTimeout(() => setMaxReachedFeedback(false), 3000)
    }
  }

  const handleRemoveBook = target => {
    const next = favouriteBooks.filter(b => b.key !== target.key)
    setFavouriteBooks(next)
    persistFavouriteBooks(next)
  }

  const slots = Array.from({ length: 4 }, (_, i) => favouriteBooks[i] ?? null)

  return (
    <Box maxW="lg" mx="auto" mt={10} px={4}>
      <Heading mb={6}>A profilom</Heading>

      <Flex gap={6} alignItems="center">
        <Box position="relative" flexShrink={0} cursor="pointer" onClick={() => fileInputRef.current?.click()}>
          <AspectRatio ratio={1} w={{ base: '120px', sm: '150px' }}>
            {profilePic ? (
              <Image src={profilePic} alt="Profile" objectFit="cover" borderRadius="md" />
            ) : (
              <Box bg="gray.200" borderRadius="md" display="flex" alignItems="center" justifyContent="center">
                <Text fontSize={{ base: '3xl', sm: '5xl' }} fontWeight="bold">
                  {(savedDisplayName || displayNameDraft || 'N')[0]?.toUpperCase?.() || 'N'}
                </Text>
              </Box>
            )}
          </AspectRatio>

          <Box position="absolute" bottom={0} w="100%" bg="blackAlpha.600" color="white" textAlign="center" fontSize="sm" py={2} borderBottomRadius="md">
            Töltsd fel a profilképed!
          </Box>

          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleProfilePicUpload} />
        </Box>

        <VStack align="start" spacing={2} flexGrow={1}>
          <Text>A nevem:</Text>

          {savedDisplayName ? (
            <Text fontSize="lg" fontWeight="bold">{savedDisplayName}</Text>
          ) : (
            <HStack w="full" align="center">
              <Input
                placeholder="Írd be a neved"
                value={displayNameDraft}
                onChange={e => { setDisplayNameDraft(e.target.value); setNameError('') }}
              />
              <Button size="sm" onClick={saveDisplayName} isDisabled={displayNameDraft.trim().length < 2}>
                Mentés
              </Button>
            </HStack>
          )}
          {nameError && <Text fontSize="sm" color="red.500">{nameError}</Text>}
          {nameFeedback && (
            <Text fontSize="sm" color={nameFeedback.startsWith('✅') ? 'green.500' : 'red.500'}>
              {nameFeedback}
            </Text>
          )}

          <Text>Jelmondat/idézet:</Text>
          <HStack w="full" align="center">
            <Input value={motto} onChange={e => setMotto(e.target.value)} />
            <Button size="sm" onClick={saveMotto}>Mentés</Button>
          </HStack>
          {mottoFeedback && (
            <Text fontSize="sm" color={mottoFeedback.startsWith('✅') ? 'green.500' : 'red.500'}>
              {mottoFeedback}
            </Text>
          )}
        </VStack>
      </Flex>

      <VStack spacing={4} align="stretch" mt={8}>
        <Separator />
        <Text>Kedvenc könyveim (maximum 4):</Text>

        <Box opacity={favouriteBooks.length >= 4 ? 0.5 : 1} pointerEvents={favouriteBooks.length >= 4 ? 'none' : 'auto'}>
          <BookSearchSelector
            onBookClick={handleAddBook}
            disableIf={book =>
              favouriteBooks.length >= 4 ||
              favouriteBooks.some(b => b.key === (book.key || book.id))
            }
          />
        </Box>

        {maxReachedFeedback && <Text color="red.500" fontSize="sm">Kiválasztottál 4 kedvenc könyvet!</Text>}

        <SimpleGrid columns={{ base: 2, sm: 4 }} columnGap={{ base: 2, sm: 4 }} rowGap={{ base: 6, sm: 4 }} justifyItems="center">
          {slots.map((b, i) => {
            if (b) {
              return (
                <Box key={b.key || `book-${i}`} position="relative">
                  {b.cover ? (
                    <Image src={b.cover} w="80px" h="120px" objectFit="cover" borderRadius="md" />
                  ) : (
                    <Box w="80px" h="120px" bg="gray.200" borderRadius="md" display="flex" alignItems="center" justifyContent="center" textAlign="center" p={2}>
                      <VStack spacing={1}>
                        <Text noOfLines={2} fontSize="xs">{b.title}</Text>
                        <Text fontSize="xx-small" color="gray.600">Borítókép feltöltése</Text>
                      </VStack>
                    </Box>
                  )}

                  {/* Cover overlay upload, autosave favourites after upload */}
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
                      const rawName = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.\-]/g, '_')
                      const keyPath = `${user.id}/favs/${b.key}_${Date.now()}_${rawName}`
                      const { error: uploadErr } = await supabase.storage.from('book-covers').upload(keyPath, file)
                      if (uploadErr) {
                        console.error('❌ Borítókép feltöltése meghiúsult:', uploadErr)
                        setUploadFeedback(`❌ Borítókép feltöltése meghiúsult: ${uploadErr.message}`)
                        return
                      }
                      const { data: urlData, error: urlErr } = await supabase.storage.from('book-covers').getPublicUrl(keyPath)
                      if (urlErr) {
                        console.error('❌ Nem találom az URL-t:', urlErr)
                        setUploadFeedback(`❌  Nem találom az URL-t: ${urlErr.message}`)
                        return
                      }
                      const publicUrl = urlData.publicUrl
                      const next = favouriteBooks.map(x => x.key === b.key ? { ...x, cover: publicUrl } : x)
                      setFavouriteBooks(next)
                      await persistFavouriteBooks(next)
                      setUploadFeedback('✅ Borítókép feltöltve és mentve!')
                      setTimeout(() => setUploadFeedback(''), 2500)
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
              )
            }

            return (
              <Box key={`placeholder-${i}`} w="80px" h="120px" bg="gray.100" borderRadius="md" display="flex" alignItems="center" justifyContent="center" textAlign="center" p={2} pointerEvents="none">
                <Text fontSize="xs" color="gray.600" noOfLines={3}>
                  Adj hozzá kedvencet a kereséssel
                </Text>
              </Box>
            )
          })}
        </SimpleGrid>

        {nameFeedback && <Text fontSize="sm" color={nameFeedback.startsWith('✅') ? 'green.500' : 'red.500'}>{nameFeedback}</Text>}
        {mottoFeedback && <Text fontSize="sm" color={mottoFeedback.startsWith('✅') ? 'green.500' : 'red.500'}>{mottoFeedback}</Text>}
        {uploadFeedback && <Text fontSize="sm" color={uploadFeedback.startsWith('✅') ? 'green.500' : 'red.500'}>{uploadFeedback}</Text>}
      </VStack>
    </Box>
  )
}
