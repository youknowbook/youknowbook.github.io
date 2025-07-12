import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Popover,
  Portal
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
  initialMeta = {},
  onSave,
  isAdmin,
  onRevert
}) {
  const backdropRef = useRef(null)
  const [status, setStatus]       = useState(initialMeta.status      || 'not_read')
  const [moodColor, setMoodColor] = useState(initialMeta.mood_color || '#ffffff')
  const [rating, setRating]       = useState(initialMeta.rating      || 0)

  useEffect(() => {
    if (isOpen) {
      setStatus(initialMeta.status      || 'not_read')
      setMoodColor(initialMeta.mood_color || '#ffffff')
      setRating(initialMeta.rating      || 0)
    }
  }, [isOpen, initialMeta])

  const handleSave = () => {
    onSave(book.id, {
      status,
      mood_color: moodColor,   // Books.jsx will strip '#'
      rating
    })
    onClose()
  }

  const renderStars = () => (
    <HStack spacing="0">
      {[...Array(5)].map((_, i) => {
        const fullVal = (i + 1) * 2
        const halfVal = fullVal - 1
        const isFull  = rating >= fullVal
        const isHalf  = rating === halfVal

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
              onClick={e => { e.stopPropagation(); setRating(halfVal) }}
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
      position="fixed" inset={0}
      bg="blackAlpha.600" zIndex={1000}
      display="flex" alignItems="center" justifyContent="center"
      onClick={e => e.target === backdropRef.current && onClose()}
    >
      <Box
        bg="white" p={6} borderRadius="md" width="320px"
        onClick={e => e.stopPropagation()}
      >
        <VStack spacing={4} align="stretch">
          <Text fontSize="lg" fontWeight="bold">Haladás a könyvvel</Text>

          <Box>
            <Text mb={1}>Haladás</Text>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid gray'
              }}
            >
              <option value="not_read">Nem olvastam</option>
              <option value="reading">Épp olvasom</option>
              <option value="read">Olvastam</option>
            </select>
          </Box>

          {status === 'read' && (
            <Box>
              <Text mb={1}>Értékelés</Text>
              {renderStars()}
            </Box>
          )}

          <Box>
            <Text mb={1}>Milyen szímű számodra a könyv?</Text>
            <Input
              type="color"
              value={moodColor}
              onChange={e => setMoodColor(e.target.value)}
              width="40px"
              p={0}
            />
          </Box>

          <HStack justify="flex-end" spacing={3} mt={4}>
            {isAdmin && (
              <Popover.Root>
                <Popover.Trigger>
                  <Button variant="outline" colorScheme="red">
                    Visszarakás
                  </Button>
                </Popover.Trigger>
                <Portal>
                  <Popover.Positioner>
                    <Popover.Content bg="red.50" p={4} borderRadius="md" w="240px">
                      <Popover.Body>
                        <Popover.Title
                          fontSize="md"
                          fontWeight="bold"
                          color="red.800"
                        >
                          Erősítsd meg a visszarakást
                        </Popover.Title>
                        <Text fontSize="sm" color="red.700" my={2}>
                          Visszarakod a várólistára?
                        </Text>
                        <HStack justify="flex-end" spacing={2}>
                          <Popover.CloseTrigger asChild>
                            <Button size="xs" onClick={async e => {
                              e.stopPropagation()
                            }}>
                              Vissza
                            </Button>
                          </Popover.CloseTrigger>
                          <Button
                            size="xs"
                            colorScheme="red"
                            onClick={async e => {
                              e.stopPropagation()
                              onRevert(book.id)
                              onClose()
                            }}
                          >
                            Visszarakás
                          </Button>
                        </HStack>
                      </Popover.Body>
                    </Popover.Content>
                  </Popover.Positioner>
                </Portal>
              </Popover.Root>
            )}
            <Button variant="outline" onClick={onClose}>Vissza</Button>
            <Button colorScheme="blue" onClick={handleSave}>Mentés</Button>
          </HStack>
        </VStack>
      </Box>
    </Box>,
    document.body
  )
}
