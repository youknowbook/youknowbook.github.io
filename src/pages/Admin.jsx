"use client"

import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Portal,
  Select,
  IconButton,
  createListCollection,
  Stack,
  Flex
} from '@chakra-ui/react'
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa'
import { format } from 'date-fns'
import { supabase } from '../api/supabaseClient'
import MeetingTime from '../components/Dashboard/MeetingTime'
import PollResults from '../components/Dashboard/PollResults'

export default function Admin() {
  // Books & meeting form
  const [books, setBooks] = useState([])
  const [selectedBooks, setSelectedBooks] = useState([])
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [success, setSuccess] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Meetings list & carousel indices
  const [meetings, setMeetings] = useState([])
  const [upcomingIndex, setUpcomingIndex] = useState(0)
  const [pastIndex, setPastIndex] = useState(0)

  // Voting (past‐meeting vote process)
  const [openPoll, setOpenPoll] = useState(null)
  const [voteSuccess, setVoteSuccess] = useState('')
  const [voteError, setVoteError] = useState('')
  const [stopSuccess, setStopSuccess] = useState('')
  const [stopError, setStopError] = useState('')

  // History‐view UI
  const [showHistory, setShowHistory] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(0)
  const [roundsList, setRoundsList] = useState([])
  const openRound = roundsList.find(r => r?.status === 'open') || null

  // Results overlay
  const [showResults, setShowResults] = useState(false)
  const [finalResult, setFinalResult] = useState(null)

  // Filter
  const [usedBookIds, setUsedBookIds] = useState([])

  // load rounds
  async function loadRounds() {
    const [openRes, closedRes] = await Promise.all([
      supabase
        .from('date_selection_rounds')
        .select('*')
        .match({ status: 'open' })
        .single(),
      supabase
        .from('date_selection_rounds')
        .select('*')
        .match({ status: 'closed' })
        .order('created_at',{ ascending:false }),
    ])
    const list = []
    if (openRes.data) list.push(openRes.data)
    if (Array.isArray(closedRes.data)) list.push(...closedRes.data)
    setRoundsList(list)
    setHistoryIndex(0)
  }

  // Fetch books + meetings
  useEffect(() => {
    fetchAvailableBooks()
    fetchMeetings()
    loadRounds()
  }, [])

  async function fetchAvailableBooks() {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author')
      .eq('is_selected', false)
    if (!error) setBooks(data || [])
  }

  async function fetchMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, location, date, time, is_active, books(id, author, title)')
    if (!error && data) {
      setMeetings(data);
      // grab all the book-IDs in use
      const ids = data
        .map(m => m.books?.id)
        .filter(Boolean);
      setUsedBookIds(ids);
    }
  }

  // Filter books
  async function fetchAvailableBooks() {
    let query = supabase
      .from('books')
      .select('id, title, author')
      .eq('is_selected', false);

    if (usedBookIds.length > 0) {
      // Supabase JS client accepts an array for an “in” filter
      query = query.not('id', 'in', usedBookIds);
    }

    const { data, error } = await query;
    if (!error) {
      setBooks(data || []);
    }
  }

  useEffect(() => {
    async function init() {
      await fetchMeetings();
      await loadRounds();
      await fetchAvailableBooks();
    }
    init();
  }, []);

  // Cancel message timers
  useEffect(() => { if (success) setTimeout(() => setSuccess(''), 3000) }, [success])
  useEffect(() => {
    if (voteSuccess || voteError) {
      setTimeout(() => {
        setVoteSuccess('')
        setVoteError('')
      }, 3000)
    }
  }, [voteSuccess, voteError])

  // Load any open poll
  useEffect(() => {
    async function loadOpenPoll() {
      const { data, error } = await supabase
        .from('polls')
        .select('id, round, tally, past_meeting_id')
        .eq('status','open')
        .maybeSingle()
      if (!error && data) setOpenPoll(data)
      else setOpenPoll(null)
    }
    loadOpenPoll()
  }, [])

  // Book select helper
  const bookCollection = createListCollection({
    items: books.map(b => ({
      label: `${b.title} – ${b.author}`,
      value: b.id
    }))
  })

  // Meeting creation
  const handleSubmit = async () => {
    setSuccess(''); setErrorMsg('')
    if (!selectedBooks[0] || !location || !date || !time) {
      setErrorMsg('❌ Töltsd ki az összes mezőt!')
      return
    }
    const today0 = new Date().setHours(0,0,0,0)
    const isActive = new Date(date).setHours(0,0,0,0) > today0
    const { error: meetErr } = await supabase
      .from('meetings')
      .insert([{
        book_id: selectedBooks[0],
        location, date, time,
        notes: [],
        is_active: isActive
      }])
    if (meetErr) {
      setErrorMsg('❌ Az esemény elkészítése meghiúsult: ' + meetErr.message)
      return
    }
    await supabase
      .from('books')
      .update({ is_selected: true })
      .eq('id', selectedBooks[0])
    setSuccess('✅ Kész az esemény!')
    await fetchMeetings()
    await fetchAvailableBooks()
    setSelectedBooks([])
    setLocation('')
    setDate('')
    setTime('')
    setUpcomingIndex(0)
    setPastIndex(0)
  }

  // Voting on past meeting
  const handleStartVote = async () => {
    setVoteSuccess(''); setVoteError('')
    const past = meetings
      .filter(m => !m.is_active)
      .sort((a,b) => new Date(b.date) - new Date(a.date))
    if (!past.length) {
      setVoteError('❌ Nincs korábbi esemény')
      return
    }
    const lastPastId = past[0].id
    const { data, error } = await supabase
      .from('polls')
      .insert([{ past_meeting_id: lastPastId, status:'open' }])
      .select('id, round, tally, past_meeting_id')
      .single()
    if (error) setVoteError('❌ ' + error.message)
    else {
      setVoteSuccess('✅ Szavazás indítva!')
      setOpenPoll(data)
    }
  }

  // Stop voting
  async function handleStopVoting() {
    setStopSuccess(''); setStopError('')
    const { error } = await supabase
      .from('polls')
      .update({ status:'complete' })
      .eq('status','open')
    if (error) setStopError('❌ Szavazás leállítása sikertelen: ' + error.message)
    else {
      setStopSuccess('✅ Szavazás leállítva.')
      setOpenPoll(null)
    }
  }

  // Date‐selection controls
  async function startDateSelection() {
    const { data: latest, error: latestErr } = await supabase
      .from('meetings')
      .select('date')
      .order('date',{ ascending:false })
      .limit(1)
      .single()
    if (latestErr || !latest) {
      console.error('Could not load latest meeting:', latestErr)
      return
    }
    const m = new Date(latest.date)
    let year = m.getFullYear()
    let month = m.getMonth() + 1 + 2
    if (month > 12) { month -= 12; year += 1 }
    const { error } = await supabase
      .from('date_selection_rounds')
      .insert({ status:'open', year, month })
      .single()
    if (error) {
      console.error('Failed to start date selection:', error)
      return
    }
    await loadRounds()
  }

  async function stopDateSelection() {
  if (!openRound) return

  // fetch all choices for this round
  const { data: choicesData, error: fetchError } = await supabase
    .from('date_selection_choices')
    .select('selected_date')
    .eq('round_id', openRound.id)

  if (fetchError) {
    console.error('Could not load selections:', fetchError)
    return
  }

  // make sure we always have an array
  const choices = choicesData || []

  // tally counts in JS
  const counts = choices.reduce((acc, { selected_date }) => {
    acc[selected_date] = (acc[selected_date] || 0) + 1
    return acc
  }, {})

  // sort dates by descending count and take top 3
  const top3 = Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([date]) => date)

  // close the round
  const { data: updatedRound, error } = await supabase
    .from('date_selection_rounds')
    .update({
      status: 'closed',
      closed_at: new Date(),
      top_dates: top3,
    })
    .eq('id', openRound.id)
    .single()

  if (error) {
    console.error('Failed to close date selection:', error)
    return
  }

  // update local list
  setRoundsList(prev => {
    const [, ...remaining] = prev
    return [...remaining, updatedRound]
  })

  await loadRounds()
}

  // Carousels
  const upcoming = meetings
    .filter(m => m.is_active)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
  const past = meetings
    .filter(m => !m.is_active)
    .sort((a,b) => new Date(b.date) - new Date(a.date))
  const prevUpcoming = () => upcomingIndex > 0 && setUpcomingIndex(upcomingIndex - 1)
  const nextUpcoming = () => upcomingIndex < upcoming.length - 1 && setUpcomingIndex(upcomingIndex + 1)
  const prevPast = () => pastIndex < past.length - 1 && setPastIndex(pastIndex + 1)
  const nextPast = () => pastIndex > 0 && setPastIndex(pastIndex - 1)
  const completeMeeting = async id => {
    await supabase.from('meetings').update({ is_active:false }).eq('id',id)
    fetchMeetings(); setUpcomingIndex(0); setPastIndex(0)
  }
  const revertMeeting = async id => {
    await supabase.from('meetings').update({ is_active:true }).eq('id',id)
    fetchMeetings(); setUpcomingIndex(0); setPastIndex(0)
  }

  const today0 = new Date().setHours(0,0,0,0)

  // Finalizer for PollResults
  async function finalizeRound(result) {
    // close current
    await supabase
      .from('polls')
      .update({
        status:'complete',
        winner: result.type === 'winner' ? result.bookId : 'next round'
      })
      .eq('id', openPoll.id)

    if (result.type !== 'winner') {
      // start next
      await supabase
        .from('polls')
        .insert([{
          past_meeting_id: openPoll.past_meeting_id,
          round: openPoll.round + 1,
          status:'open',
          tally: {}
        }])
    }

    // reload open poll
    const { data: next } = await supabase
      .from('polls')
      .select('id, round, tally, past_meeting_id')
      .eq('status','open')
      .maybeSingle()

    setOpenPoll(next)
    setShowResults(false)
    setFinalResult(null)
  }

  return (
    <Box maxW="lg" mx="auto" mt={10} px={{ base:2, md:6 }}>
      <Heading mb={4}>📅 Az esemény elkészítése</Heading>

      {/* PollResults overlay */}
      {showResults && openPoll && (
        <Box
          position="fixed"
          inset={0}
          bg="white"
          zIndex="overlay"
          p={6}
          overflowY="auto"
        >
          <IconButton
            aria-label="Bezár"
            onClick={() => setShowResults(false)}
            position="absolute"
            top="4"
            right="4"
            variant="ghost"
            size="lg"
          >
            <FaTimes/>
          </IconButton>

          <PollResults
            pollId={openPoll.id}
            tally={openPoll.tally}
            onComplete={(pollId, result) => setFinalResult(result)}
          />

          {finalResult && (
            <Flex justify="center" mt={6}>
              {finalResult.type === 'winner' ? (
                <Button colorScheme="green" onClick={() => finalizeRound(finalResult)}>
                  Megvan a győztes!
                </Button>
              ) : (
                <Button colorScheme="orange" onClick={() => finalizeRound(finalResult)}>
                  Szavazzunk még egyszer!
                </Button>
              )}
            </Flex>
          )}
        </Box>
      )}

      {/* Create Meeting Form */}
      <VStack spacing={4} align="stretch">
        <Select.Root
          collection={bookCollection}
          value={selectedBooks}
          onValueChange={e => setSelectedBooks(e.value)}
        >
          <Select.HiddenSelect aria-label="Válassz egy könyvet!" />
          <Select.Label>Válassz egy könyvet!</Select.Label>
          <Select.Control>
            <Select.Trigger onClick={fetchAvailableBooks}>
              <Select.ValueText placeholder="Válassz egy könyvet!" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator/>
              <Select.ClearTrigger/>
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {bookCollection.items.map(item => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                    <Select.ItemIndicator/>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
        <Input placeholder="Helyszín" value={location} onChange={e => setLocation(e.target.value)} />
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
        <Button colorScheme="blue" onClick={handleSubmit}>
          Esemény elkészítése
        </Button>
        {success && <Text color="green.500">{success}</Text>}
        {errorMsg && <Text color="red.500">{errorMsg}</Text>}
      </VStack>

      {/* Upcoming Meetings */}
      <Heading size="md" mt={8} mb={4}>Közelgő esemény</Heading>
      {upcoming.length > 0 ? (
        <HStack>
          {upcoming.length > 1 && (
            <IconButton
              onClick={prevUpcoming}
              disabled={upcomingIndex === 0}
              aria-label="Régebbi közelgők"
            >
              <FaChevronLeft size={24}/>
            </IconButton>
          )}
          <Box
            key={upcoming[upcomingIndex].id}
            position="relative"
            p={3}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            flex="1"
          >
            <Text fontWeight="bold">{upcoming[upcomingIndex].books.title}</Text>
            <Text fontSize="sm">{upcoming[upcomingIndex].books.author}</Text>
            <Text fontSize="sm">
              {upcoming[upcomingIndex].date} @ {upcoming[upcomingIndex].time}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Helyszín: {upcoming[upcomingIndex].location}
            </Text>
            <Button
              position="absolute"
              right="16px"
              top="50%"
              transform="translateY(-50%)"
              size="sm"
              colorScheme="red"
              onClick={() => completeMeeting(upcoming[upcomingIndex].id)}
            >
              Esemény lezárása
            </Button>
          </Box>
          {upcoming.length > 1 && (
            <IconButton
              onClick={nextUpcoming}
              disabled={upcomingIndex === upcoming.length - 1}
              aria-label="Újabb közelgők"
            >
              <FaChevronRight size={24}/>
            </IconButton>
          )}
        </HStack>
      ) : (
        <Text>Nincs közelgő esemény.</Text>
      )}

      {/* Voting Controls */}
      {upcoming.length === 0 && (
        <Box textAlign="center" mt={6}>
          {!openPoll ? (
            <>
              <Button colorScheme="teal" onClick={handleStartVote}>
                Szavazás indítása
              </Button>
              {voteSuccess && <Text color="green.500" mt={2}>{voteSuccess}</Text>}
              {voteError   && <Text color="red.500"   mt={2}>{voteError}</Text>}
            </>
          ) : (
            <>
              {/* if no tally field yet, it's "in progress" */}
              {!openPoll.tally || Object.keys(openPoll.tally).length === 0 ? (
                <Text color="blue.600" mb={2}>
                  Szavazás folyamatban…
                </Text>
              ) : (
                <Text color="purple.600" mb={2}>
                  Vége az {openPoll.round}. körnek
                </Text>
              )}

              <HStack justify="center" spacing={4}>
                <Button colorScheme="red" onClick={handleStopVoting}>
                  Szavazás leállítása
                </Button>
                {/* Only show "Eredményhirdetés" once tally exists */}
                {openPoll.tally && Object.keys(openPoll.tally).length > 0 && (
                  <Button colorScheme="teal" onClick={() => setShowResults(true)}>
                    Eredményhirdetés
                  </Button>
                )}
              </HStack>

              {stopSuccess && <Text color="green.500" mt={2}>{stopSuccess}</Text>}
              {stopError   && <Text color="red.500"   mt={2}>{stopError}</Text>}
            </>
          )}
        </Box>
      )}

      {/* Date‐selection controls */}
      {upcoming.length === 0 && (
        <Stack direction={{ base:'column', md:'row' }} align="center" justify="center" spacing={4} mt={6}>
          {!openRound ? (
            <Button w="200px" colorScheme="teal" onClick={startDateSelection}>
              Dátum választás indítása
            </Button>
          ) : (
            <Button w="200px" colorScheme="red" onClick={stopDateSelection}>
              Dátum választás leállítása
            </Button>
          )}
          {roundsList.length > 0 && (
            <Button w="200px" variant="outline" onClick={() => setShowHistory(true)}>
              Korábbi dátum választások
            </Button>
          )}
        </Stack>
      )}

      {/* History overlay */}
      {showHistory && roundsList.length > 0 && (
        <Box
          position="fixed"
          inset={0}
          bg="white"
          zIndex="overlay"
          p={6}
          overflowY="auto"
        >
          <IconButton
            aria-label="Bezár"
            onClick={() => setShowHistory(false)}
            position="absolute"
            top="4"
            left="4"
            variant="ghost"
            size="lg"
          >
            <FaTimes/>
          </IconButton>

          <HStack justify="center" spacing={4} mb={4}>
            <IconButton
              aria-label="Korábbi kör"
              onClick={() => setHistoryIndex(i => Math.min(i+1, roundsList.length-1))}
              disabled={historyIndex >= roundsList.length-1}
            >
              <FaChevronLeft/>
            </IconButton>
            <Text fontSize="lg" fontWeight="bold">
              {format(new Date(roundsList[historyIndex].created_at), 'yyyy-MM-dd')} ({roundsList[historyIndex].status})
            </Text>
            <IconButton
              aria-label="Újabb kör"
              onClick={() => setHistoryIndex(i => Math.max(i-1, 0))}
              disabled={historyIndex <= 0}
            >
              <FaChevronRight/>
            </IconButton>
          </HStack>

          <MeetingTime
            key={roundsList[historyIndex].id}
            roundId={roundsList[historyIndex].id}
            readOnly={true}
          />
        </Box>
      )}

      {/* Past Meetings carousel */}
      <Heading size="md" mt={8} mb={4}>Korábbi események</Heading>
      {past.length > 0 ? (
        <HStack>
          {past.length > 1 && (
            <IconButton
              onClick={prevPast}
              disabled={pastIndex >= past.length-1}
              aria-label="Régebbiek"
            >
              <FaChevronLeft size={24}/>
            </IconButton>
          )}
          <Box
            key={past[pastIndex].id}
            position="relative"
            p={3}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            flex="1"
          >
            <Text fontWeight="bold">{past[pastIndex].books.title}</Text>
            <Text fontSize="sm">{past[pastIndex].books.author}</Text>
            <Text fontSize="sm">
              {past[pastIndex].date} @ {past[pastIndex].time}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Helyszín: {past[pastIndex].location}
            </Text>
            {new Date(past[pastIndex].date).setHours(0,0,0,0) > today0 && (
              <Button
                position="absolute"
                right="16px"
                top="50%"
                transform="translateY(-50%)"
                size="sm"
                colorScheme="green"
                onClick={() => revertMeeting(past[pastIndex].id)}
              >
                Visszaállít
              </Button>
            )}
          </Box>
          {past.length > 1 && (
            <IconButton
              onClick={nextPast}
              disabled={pastIndex === 0}
              aria-label="Újabbak"
            >
              <FaChevronRight size={24}/>
            </IconButton>
          )}
        </HStack>
      ) : (
        <Text>Nem voltak korábbi események.</Text>
      )}
    </Box>
  )
}
