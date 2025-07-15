'use client'
import React, { useState, useEffect } from 'react'
import { Box, Grid, Image, Text, Flex, Badge, VStack } from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'

export default function PollResults({ pollId, tally, onComplete }) {
  const votes = Object.values(tally || {})
  const totalVotes = votes.length
  const [deck] = useState(() => [...votes].sort(() => Math.random() - 0.5))
  const [flipped, setFlipped] = useState(new Set())
  const [booksMap, setBooksMap] = useState({})
  const [countsMap, setCountsMap] = useState({}) // track per-title counts

  console.log('render PollResults — votes:', votes.length)


  // fetch book details once
  useEffect(() => {
    const ids = Array.from(new Set(votes))
    if (!ids.length) return
    supabase
      .from('books')
      .select('id, title, cover_url')
      .in('id', ids)
      .then(({ data }) => {
        const map = {}
        data.forEach(b => (map[b.id] = b))
        setBooksMap(map)
      })
  }, [])

  function handleFlip(idx) {
    if (flipped.has(idx)) return
    const newSet = new Set(flipped)
    newSet.add(idx)
    setFlipped(newSet)

    const bookId = deck[idx]
    const title = booksMap[bookId]?.title || 'N/A'
    setCountsMap(prev => ({
      ...prev,
      [title]: (prev[title] || 0) + 1
    }))

    if (newSet.size === totalVotes) {
      const counts = votes.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1
        return acc
      }, {})
      const sorted = Object.entries(counts).sort(([,a],[,b]) => b - a)
      const [winId, topCount] = sorted[0]
      const majority = topCount > totalVotes / 2
      let result
      if (majority) {
        result = { type: 'winner', bookId: winId }
      } else {
        const tieIds = sorted.filter(([,c]) => c === topCount).map(([id]) => id)
        if (tieIds.length > 1) {
          result = { type: 'newRound', filter: tieIds }
        } else {
          const secondCount = sorted[1]?.[1] || 0
          const secondIds = sorted.filter(([,c]) => c === secondCount).map(([id]) => id)
          result = { type: 'newRound', filter: [winId, ...secondIds] }
        }
      }
      onComplete?.(pollId, result)
    }
  }

  return (
    <Flex direction="column" align="center" p={4}>
      <Flex flexWrap="wrap" justify="center" mb={4}>
        {Object.entries(countsMap).map(([title, count]) => (
          <Badge
            key={title}
            variant="solid"
            colorScheme="teal"
            borderRadius="full"
            px={3}
            py={1}
            m={1}
          >
            {title} <Box as="span" fontWeight="bold">×{count}</Box>
          </Badge>
        ))}
        {Object.keys(countsMap).length === 0 && (
          <Text fontSize="lg" color="gray.500">
            Kattints egy mezőre a felfedéshez
          </Text>
        )}
      </Flex>

      <Grid
        templateColumns="repeat(auto-fill, minmax(120px, 1fr))"
        gap={4}
        w="100%"
        maxW="800px"
        justifyItems="center"
      >
        {deck.map((bookId, idx) => (
          <Box
            key={idx}
            h="150px"
            w="120px"
            bg="gray.200"
            borderRadius="md"
            overflow="hidden"
            cursor={flipped.has(idx) ? 'default' : 'pointer'}
            onClick={() => handleFlip(idx)}
            position="relative"
            boxShadow={flipped.has(idx) ? 'md' : 'sm'}
            transition="transform 0.2s"
            _hover={!flipped.has(idx) ? { transform: 'scale(1.05)' } : undefined}
          >
            {flipped.has(idx) && booksMap[bookId] && (
              <>
                <Image
                  src={booksMap[bookId].cover_url}
                  alt={booksMap[bookId].title}
                  objectFit="cover"
                  w="100%"
                  h="100%"
                />
                <Box
                  position="absolute"
                  bottom="0"
                  w="100%"
                  bg="rgba(0,0,0,0.6)"
                  color="white"
                  p={1}
                  textAlign="center"
                  fontSize="xs"
                >
                  {booksMap[bookId].title}
                </Box>
              </>
            )}
          </Box>
        ))}
      </Grid>
    </Flex>
  )
}
