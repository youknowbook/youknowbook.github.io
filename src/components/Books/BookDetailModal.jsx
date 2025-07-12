import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Box,
  Image,
  VStack,
  HStack,
  Text,
  Avatar,
  Button,
  Spinner
} from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'

export default function BookDetailModal({ book, isOpen, onClose }) {
  const backdropRef = useRef(null)

  // local state for the *full* book record
  const [details, setDetails] = useState(null)
  // avatar URL state
  const [avatarUrl, setAvatarUrl] = useState(null)

  // 1) fetch the fresh book details
  useEffect(() => {
    if (isOpen && book?.id) {
      supabase
        .from('books')
        .select(`
          id,
          title,
          author,
          cover_url,
          genre,
          page_count,
          country,
          author_gender,
          message,
          user_id,
          added_by,
          message
        `)
        .eq('id', book.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setDetails(data)
          } else {
            console.error('Nem sikerült betölteni a könyv részleteit:', error)
            setDetails(book)  // fallback to whatever we have
          }
        })
    }
  }, [isOpen, book])

  // 2) fetch the avatar
  useEffect(() => {
    if (isOpen && details?.user_id) {
      supabase
        .from('users')
        .select('profile_picture')
        .eq('id', details.user_id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setAvatarUrl(data.profile_picture)
          }
        })
    }
  }, [isOpen, details])

  // don't render until we've at least attempted to load
  if (!isOpen) return null
  if (!details) {
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
      >
        <Spinner size="xl" color="white" />
      </Box>,
      document.body
    )
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
      onClick={e => e.target === backdropRef.current && onClose()}
    >
      <Box
        bg="white"
        p={6}
        borderRadius="md"
        maxW="lg"
        w="full"
        boxShadow="2xl"
        onClick={e => e.stopPropagation()}
      >
        <VStack align="start" spacing={6}>
          <HStack align="start" spacing={6}>
            <Image
                src={details.cover_url}
                alt={`${details.title} cover`}
                w={{ base: '160px', md: '200px' }}
                h="auto"
                objectFit="contain"
                borderRadius="md"
            />
            <VStack align="start" spacing={2} flex="1">
              <Text fontSize="xl" fontWeight="bold">
                {details.title}
              </Text>
              <Text fontSize="md">
                {details.author}
                {details.author_gender && ` (${details.author_gender})`}
              </Text>
              <Text fontSize="sm">
                Műfaj:{' '}
                {Array.isArray(details.genre)
                  ? details.genre.join(', ')
                  : details.genre}
              </Text>
              {details.page_count != null && (
                <Text fontSize="sm">Oldalszám: {details.page_count}</Text>
              )}
              {details.country && (
                <Text fontSize="sm">Ország: {details.country}</Text>
              )}
            </VStack>
          </HStack>

          <HStack align="center" spacing={4} w="full">
            <Avatar.Root size="sm" key="sm">
                <Avatar.Fallback name={book.added_by} />
                <Avatar.Image src={avatarUrl} />  
            </Avatar.Root>
            <Box
              bg="gray.100"
              p={3}
              borderRadius="md"
              flex="1"
              whiteSpace="pre-wrap"
            >
              {details.message}
            </Box>
          </HStack>

          <Box w="full" textAlign="right">
            <Button onClick={onClose}>Bezárás</Button>
          </Box>
        </VStack>
      </Box>
    </Box>,
    document.body
  )
}
