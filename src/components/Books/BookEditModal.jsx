import {
  Box,
  Input,
  Text,
  Button,
  Image,
  VStack,
  Textarea
} from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../api/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function BookEditModal({ book, isOpen, onClose, onBookAdded, clearSearch }) {
  const { user } = useAuth()
  const backdropRef = useRef(null)
  const genreRef = useRef(null)

  const [formData, setFormData] = useState(book || {})
  const [feedback, setFeedback] = useState('')
  const [showGenreWarning, setShowGenreWarning] = useState(false)

  useEffect(() => {
    if (isOpen && book?.id) {
      supabase
        .from('books')
        .select('id, title, author, cover_url, genre, page_count, country, author_gender, user_id, added_by, message, release_year')
        .eq('id', book.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Could not load book data:', error)
            setFormData(book)
          } else {
            setFormData({
              ...data,
              genre: Array.isArray(data.genre) ? data.genre.join(', ') : data.genre,
              message: data.message || '',
              release_year: data.release_year || '',
            })
          }
          setFeedback('')
          setShowGenreWarning(false)
        })
    }
  }, [isOpen, book])

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value })
    if (field === 'genre') setShowGenreWarning(false)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const filePath = `${user.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('book-covers').upload(filePath, file)
    if (uploadError) {
      console.error('❌ Feltöltési hiba:', uploadError.message)
      setFeedback(`❌ Képfeltöltési hiba: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('book-covers').getPublicUrl(filePath)
    const imageUrl = publicUrlData?.publicUrl
    setFormData(prev => ({ ...prev, cover_url: imageUrl }))
    setFeedback('✅ A képet sikeresen feltöltöttük.')
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.author) {
      setFeedback('❌ A cím és a szerző nem elérhető.')
      return
    }

    const rawGenre = Array.isArray(formData.genre)
      ? formData.genre.join(', ')
      : (formData.genre || '')

    if (!rawGenre.trim()) {
      setShowGenreWarning(true)
      genreRef.current?.focus()
      return
    }

    // Build the common (editable) payload
    const basePayload = {
      title: (formData.title || '').trim(),
      author: (formData.author || '').trim(),
      cover_url: formData.cover_url || '',
      genre: rawGenre.split(',').map(g => g.trim()).filter(Boolean),
      page_count: formData.page_count ? Number(formData.page_count) : null,
      country: formData.country || '',
      author_gender: formData.author_gender || '',
      release_year: formData.release_year ? Number(formData.release_year) : null,
      message: formData.message || '',
    }

    const isEditing = !!formData.id
    let error

    if (isEditing) {
      // 🔒 UPDATE: do NOT send added_by / user_id — keep original creator
      const res = await supabase
        .from('books')
        .update(basePayload)
        .eq('id', formData.id)
      error = res.error
    } else {
      // ➕ INSERT: set creator once (use UUID), optionally also user_id if you keep it
      const insertPayload = {
        ...basePayload,
        added_by: user.id,   // 🔒 set once on insert
        user_id: user.id,    // (optional) if your schema has this column
      }
      const res = await supabase.from('books').insert(insertPayload)
      error = res.error
    }

    if (error) {
      setFeedback(`❌ Nem tudtuk elmenteni a könyvet: ${error.message}`)
    } else {
      setFeedback('✅ Könyv mentve!')
      onBookAdded?.()
      clearSearch?.()
      setTimeout(() => {
        onClose?.()
        setFeedback('')
      }, 800)
    }
  }

  return createPortal(
    <Box
      ref={backdropRef}
      position="fixed"
      inset={0}
      bg="blackAlpha.600"
      zIndex={1000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <Box
        bg="white"
        p={6}
        borderRadius="md"
        maxW="md"
        w="full"
        boxShadow="2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack spacing={4} align="stretch">
          {formData.cover_url && (
            <Image
              src={formData.cover_url}
              alt="Könyvborító"
              boxSize="120px"
              objectFit="cover"
              borderRadius="md"
              alignSelf="flex-start"
            />
          )}

          <Input type="file" accept="image/*" onChange={handleImageUpload} />

          <Input value={formData.title || ''} onChange={handleChange('title')} placeholder="Cím" />
          <Input value={formData.author || ''} onChange={handleChange('author')} placeholder="Szerző" />

          <Box position="relative">
            <Input
              ref={genreRef}
              value={formData.genre || ''}
              onChange={handleChange('genre')}
              placeholder="Műfaj(ok) – vesszőkkel elválasztva"
            />
            {showGenreWarning && (
              <Box
                position="absolute"
                top="100%"
                left="0"
                mt="1"
                bg="yellow.100"
                px="2"
                py="1"
                borderRadius="md"
                boxShadow="md"
                zIndex="tooltip"
              >
                <Text fontSize="xs" color="yellow.800">
                  Írj be legalább egy műfajt
                </Text>
              </Box>
            )}
          </Box>

          <Input value={formData.page_count || ''} type="number" onChange={handleChange('page_count')} placeholder="Oldalszám" />
          <Input value={formData.country || ''} onChange={handleChange('country')} placeholder="Ország" />
          <Input value={formData.author_gender || ''} onChange={handleChange('author_gender')} placeholder="A szerző neme (pl. férfi, nő, egyéb)" />
          <Input value={formData.release_year || ''} onChange={handleChange('release_year')} placeholder="Kiadási év" type="number" />
          <Textarea value={formData.message || ''} onChange={handleChange('message')} placeholder="Miért ajánlod olvasására? (opcionális)" />

          {feedback && (
            <Text fontSize="sm" color={feedback.startsWith('✅') ? 'green.500' : 'red.500'}>
              {feedback}
            </Text>
          )}

          <Box display="flex" justifyContent="flex-end" gap={3}>
            <Button onClick={onClose}>Vissza</Button>
            <Button colorScheme="blue" onClick={handleSubmit}>
              {formData.id ? 'Mentés' : 'Várólistára'}
            </Button>
          </Box>
        </VStack>
      </Box>
    </Box>,
    document.body
  )
}
