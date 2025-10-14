'use client'
import React, { useState, useEffect } from 'react'
import { Box, Grid, Image, Text, Flex, Badge } from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'

const TIE_SENTINEL = 'all tie'

// helper: recompute all-tie from a { user_id -> book_id } tally
function isAllTieFromTally(tally) {
  if (!tally) return false
  const perBook = {}
  for (const bid of Object.values(tally)) {
    perBook[bid] = (perBook[bid] || 0) + 1
  }
  const vals = Object.values(perBook)
  return vals.length > 1 && vals.every(c => c === vals[0])
}

export default function PollResults({ pollId, tally, onComplete }) {
  // current round votes (deck to flip)
  const votes = Object.values(tally || {})
  const totalVotes = votes.length
  const [deck] = useState(() => [...votes].sort(() => Math.random() - 0.5))
  const [flipped, setFlipped] = useState(new Set())

  // book details used for badges/titles
  const [booksMap, setBooksMap] = useState({}) // { book_id: {id,title,cover_url} }

  // cumulative counters shown as badges at the top (keyed by book_id)
  const [prevTieCounts, setPrevTieCounts] = useState({}) // from previous consecutive all-tie rounds
  const [countsByBook, setCountsByBook] = useState({})   // prevTieCounts + current flips

  // meta for fetching previous rounds
  const [meta, setMeta] = useState({ past_meeting_id: null, round: null })

  // 1) load poll meta (past_meeting_id, round) and consecutive previous all-tie counts
  useEffect(() => {
    let cancelled = false
    async function loadMetaAndPrev() {
      // meta for this poll
      const { data: pollRow, error: metaErr } = await supabase
        .from('polls')
        .select('past_meeting_id, round')
        .eq('id', pollId)
        .single()
      if (metaErr || !pollRow) return
      if (cancelled) return
      setMeta(pollRow)

      // pull previous finished polls for this meeting, earlier rounds
      const { data: prevPolls } = await supabase
        .from('polls')
        .select('id, round, winner, tally, created_at, status')
        .eq('past_meeting_id', pollRow.past_meeting_id)
        .lt('round', pollRow.round)
        .eq('status', 'complete')

      // keep newest row per round number
      const latestByRound = {}
      for (const p of (prevPolls || [])) {
        const r = Number.isFinite(p.round) ? p.round : 0
        const prev = latestByRound[r]
        if (!prev || new Date(p.created_at) > new Date(prev.created_at)) {
          latestByRound[r] = p
        }
      }

      // walk backwards from (round-1) while each is a tie → accumulate their tallies
      const roundsDesc = Object.values(latestByRound).sort((a, b) => b.round - a.round)
      let counts = {}
      for (const row of roundsDesc) {
        // only consider consecutive ties starting from the most recent previous round
        // once we meet a non-tie, we break
        const isTie =
          row.winner === TIE_SENTINEL ||
          row.winner === 'next round' ||     // legacy sentinel
          (!row.winner && isAllTieFromTally(row.tally))

        if (!isTie) break

        for (const bid of Object.values(row.tally || {})) {
          counts[bid] = (counts[bid] || 0) + 1
        }
      }

      if (cancelled) return
      setPrevTieCounts(counts)
      setCountsByBook(counts) // seed the badges with previous tie totals
    }

    loadMetaAndPrev()
    return () => { cancelled = true }
  }, [pollId])

  // 2) fetch the book details for every book we might show (prev ties + current round)
  useEffect(() => {
    const ids = Array.from(new Set([...votes, ...Object.keys(prevTieCounts)]))
    if (!ids.length) return
    supabase
      .from('books')
      .select('id, title, cover_url')
      .in('id', ids)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(b => { map[b.id] = b })
        setBooksMap(map)
      })
  }, [votes, prevTieCounts])

  // 3) flipping logic – increments the cumulative counter (prev ties + this round)
  function handleFlip(idx) {
    if (flipped.has(idx)) return
    const newSet = new Set(flipped)
    newSet.add(idx)
    setFlipped(newSet)

    const bookId = deck[idx]
    setCountsByBook(prev => ({
      ...prev,
      [bookId]: (prev[bookId] || 0) + 1
    }))

    if (newSet.size === totalVotes) {
      // when all revealed: compute result using cumulative counts = prevTieCounts + current round
      const currentCounts = votes.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1
        return acc
      }, {})
      const combined = { ...prevTieCounts }
      for (const [bid, c] of Object.entries(currentCounts)) {
        combined[bid] = (combined[bid] || 0) + c
      }

      const combinedTotal =
        Object.values(prevTieCounts).reduce((a, b) => a + b, 0) + totalVotes

      const sorted = Object.entries(combined).sort(([, a], [, b]) => b - a)
      const [winId, topCount] = sorted[0] || [null, 0]
      const majority = topCount > combinedTotal / 2

      let result
      if (majority && winId) {
        result = { type: 'winner', bookId: winId }
      } else {
        const topIds = sorted.filter(([, c]) => c === topCount).map(([id]) => id)
        if (topIds.length > 1) {
          // still tie → new round
          result = { type: 'newRound', filter: topIds }
        } else {
          // single leader but no majority → include second place ids
          const secondCount = sorted[1]?.[1] || 0
          const secondIds = sorted.filter(([, c]) => c === secondCount).map(([id]) => id)
          result = { type: 'newRound', filter: [winId, ...secondIds] }
        }
      }

      onComplete?.(pollId, result)
    }
  }

  return (
    <Flex direction="column" align="center" p={4}>
      {/* Top badges: cumulative counts (prev ties + revealed current flips) */}
      <Flex flexWrap="wrap" justify="center" mb={4}>
        {Object.keys(countsByBook).length > 0 ? (
          Object.entries(countsByBook).map(([bookId, count]) => (
            <Badge
              key={bookId}
              variant="solid"
              colorScheme="teal"
              borderRadius="full"
              px={3}
              py={1}
              m={1}
              title={booksMap[bookId]?.title || bookId}
            >
              {(booksMap[bookId]?.title || 'N/A')}{' '}
              <Box as="span" fontWeight="bold">×{count}</Box>
            </Badge>
          ))
        ) : (
          <Text fontSize="lg" color="gray.500">
            Kattints egy mezőre a felfedéshez
          </Text>
        )}
      </Flex>

      {/* Grid of current-round cards to flip */}
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
