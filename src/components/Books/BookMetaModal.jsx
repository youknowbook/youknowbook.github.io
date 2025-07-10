// components/Books/BookMetaModal.jsx
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input
} from '@chakra-ui/react'
import {
  FaStar,
  FaStarHalfAlt,
  FaRegStar
} from 'react-icons/fa'

export default function BookMetaModal({
  isOpen,
  onClose,
  book,
  initialMeta = {},    // { status, mood_color, rating }
  onSave               // (bookId, {status, mood_color, rating}) => ...
}) {
  const backdropRef = useRef(null)
  const [status, setStatus]         = useState(initialMeta.status      || 'not_read')
  const [moodColor, setMoodColor]   = useState(initialMeta.mood_color  || '#ffffff')
  const [rating, setRating]         = useState(initialMeta.rating      || 0)

  useEffect(() => {
    if (isOpen) {
      setStatus(initialMeta.status     || 'not_read')
      setMoodColor(initialMeta.mood_color || '#ffffff')
      setRating(initialMeta.rating     || 0)
    }
  }, [isOpen, initialMeta])

  const handleSave = () => {
    onSave(book.id, { status, mood_color: moodColor, rating })
    onClose()
  }

  // clickable star grid
  const renderStars = () => (
    <HStack spacing="0">
      {[...Array(5)].map((_, i) => {
        const fullVal = (i + 1) * 2
        const halfVal = fullVal - 1
        const cur = rating
        const isFull = cur >= fullVal
        const isHalf = cur === halfVal

        return (
          <Box
            key={i}
            position="relative"
            fontSize="1.5rem"
            cursor="pointer"
            onClick={() => setRating(fullVal)}
          >
            {isFull
              ? <FaStar />
              : isHalf
                ? <FaStarHalfAlt />
                : <FaRegStar />
            }
            <Box
              position="absolute"
              top="0"
              left="0"
              width="50%"
              height="100%"
              onClick={e => {
                e.stopPropagation()
                setRating(halfVal)
              }}
            />
          </Box>
        )
      })}
    </HStack>
  )

  if (!isOpen) return null
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
      onClick={e => e.target === backdropRef.current && onClose()}
    >
      <Box
        bg="white"
        p={6}
        borderRadius="md"
        width="320px"
        onClick={e => e.stopPropagation()}
      >
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Update your notes</Text>

          {/* Status selector */}
          <Box>
            <Text mb={1}>Status</Text>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid gray' }}
            >
              <option value="not_read">Not read</option>
              <option value="reading">Reading</option>
              <option value="read">Read</option>
            </select>
          </Box>

          {/* Rating (only if read) */}
          {status === 'read' && (
            <Box>
              <Text mb={1}>Rating</Text>
              {renderStars()}
            </Box>
          )}

          {/* Color picker */}
          <Box>
            <Text mb={1}>Mood color</Text>
            <Input
              type="color"
              value={moodColor}
              onChange={e => setMoodColor(e.target.value)}
              width="40px"
              p={0}
            />
          </Box>

          {/* Actions */}
          <HStack spacing={3} justify="flex-end" mt={4}>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave}>Save</Button>
          </HStack>
        </VStack>
      </Box>
    </Box>,
    document.body
  )
}
