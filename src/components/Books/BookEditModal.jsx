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
  const [formData, setFormData] = useState(book || {})
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (isOpen && book) {
      setFormData(book)
      setFeedback('')
    }
  }, [isOpen, book])

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value })
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return

    const filePath = `${user.id}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('book-covers')
      .upload(filePath, file)

    if (uploadError) {
      console.error('❌ Upload failed:', uploadError.message)
      setFeedback(`❌ Image upload failed: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('book-covers')
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData?.publicUrl
    setFormData((prev) => ({ ...prev, cover_url: imageUrl }))
    setFeedback('✅ Image uploaded successfully.')
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.author) {
        setFeedback('❌ Title and author are required.')
        return
    }

    const payload = {
        title: formData.title,
        author: formData.author,
        cover_url: formData.cover_url || '',
        genre: formData.genre?.split(',').map((g) => g.trim()) || [],
        page_count: formData.page_count ? parseInt(formData.page_count) : null,
        country: formData.country || '',
        author_gender: formData.author_gender || '',
        user_id: user.id,
    }

    let error
    if (formData.id) {
        // Edit mode: update existing row
        const res = await supabase.from('books').update(payload).eq('id', formData.id)
        error = res.error
    } else {
        // Add mode: insert new row
        const res = await supabase.from('books').insert(payload)
        error = res.error
    }

    if (error) {
        setFeedback(`❌ Failed to save book: ${error.message}`)
    } else {
        setFeedback('✅ Book saved!')
        setTimeout(() => {
        onClose()
        setFeedback('')
        }, 1000)
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
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
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
              alt="Book cover"
              boxSize="120px"
              objectFit="cover"
              borderRadius="md"
              alignSelf="flex-start"
            />
          )}

          <Input type="file" accept="image/*" onChange={handleImageUpload} />

          <Input value={formData.title} onChange={handleChange('title')} placeholder="Title" />
          <Input value={formData.author} onChange={handleChange('author')} placeholder="Author" />
          <Input value={formData.genre} onChange={handleChange('genre')} placeholder="Genre (comma-separated)" />
          <Input value={formData.page_count} type="number" onChange={handleChange('page_count')} placeholder="Page Count" />
          <Input value={formData.country} onChange={handleChange('country')} placeholder="Country" />
          <Input value={formData.author_gender} onChange={handleChange('author_gender')} placeholder="Author Gender" />
          <Textarea value={formData.cover_url} onChange={handleChange('cover_url')} placeholder="Cover URL" />

          {feedback && (
            <Text fontSize="sm" color={feedback.startsWith('✅') ? 'green.500' : 'red.500'}>
              {feedback}
            </Text>
          )}

          <Box display="flex" justifyContent="flex-end" gap={3}>
            <Button onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSubmit}>
              Add to Waitlist
            </Button>
          </Box>
        </VStack>
      </Box>
    </Box>,
    document.body
  )
}
