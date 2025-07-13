"use client"

import { useState, useEffect } from 'react'
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
  createListCollection
} from '@chakra-ui/react'
import { IoChevronBackSharp, IoChevronForwardSharp } from 'react-icons/io5'
import { supabase } from '../api/supabaseClient'

export default function Admin() {
  const [books, setBooks] = useState([])
  const [selectedBooks, setSelectedBooks] = useState([])
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [success, setSuccess] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [meetings, setMeetings] = useState([])

  // New: track open poll
  const [hasOpenPoll, setHasOpenPoll] = useState(false)
  const [voteSuccess, setVoteSuccess] = useState('')
  const [voteError, setVoteError] = useState('')

  const [upcomingIndex, setUpcomingIndex] = useState(0)
  const [pastIndex, setPastIndex] = useState(0)
  const [stopSuccess, setStopSuccess] = useState('')
  const [stopError, setStopError]     = useState('')

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(''), 3000)
      return () => clearTimeout(t)
    }
  }, [success])

  // auto-clear vote messages
  useEffect(() => {
    if (voteSuccess || voteError) {
      const t = setTimeout(() => {
        setVoteSuccess('')
        setVoteError('')
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [voteSuccess, voteError])

  async function fetchAvailableBooks() {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author')
      .eq('is_selected', false)
    if (error) console.error('Könyvbetöltési hiba:', error)
    else setBooks(data || [])
  }

  async function fetchMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, location, date, time, is_active, books(id, title, author)')
    if (error) console.error('Találkozó betöltési hiba:', error)
    else setMeetings(data || [])
  }

  // New: check for open poll
  useEffect(() => {
    async function fetchOpenPoll() {
      const { data, error } = await supabase
        .from('polls')
        .select('id')
        .eq('status', 'open')
        .single()
      if (!error && data) setHasOpenPoll(true)
    }
    fetchOpenPoll()
  }, [])

  useEffect(() => {
    fetchAvailableBooks()
    fetchMeetings()
  }, [])

  const bookCollection = createListCollection({
    items: books.map((b) => ({ label: `${b.title} – ${b.author}`, value: b.id }))
  })

  const handleSubmit = async () => {
    setSuccess('')
    setErrorMsg('')

    const bookId = selectedBooks[0]
    if (!bookId || !location || !date || !time) {
      setErrorMsg('❌ Töltsd ki az összes mezőt!')
      return
    }

    const today0 = new Date().setHours(0, 0, 0, 0)
    const isActive = new Date(date).setHours(0, 0, 0, 0) > today0

    const { error: meetingError } = await supabase
      .from('meetings')
      .insert([{ book_id: bookId, location, date, time, notes: [], is_active: isActive }])
    if (meetingError) {
      setErrorMsg('❌ Az esemény elkészítése meghiúsult: ' + meetingError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('books')
      .update({ is_selected: true })
      .eq('id', bookId)
    if (updateError) {
      setErrorMsg('❌ Az esemény kész, de a könyv nem került kiválasztásra.')
      return
    }

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

  // New: start voting process
  const handleStartVote = async () => {
    setVoteSuccess('')
    setVoteError('')

    // need at least one past meeting
    const pastMeetings = meetings
      .filter((m) => !m.is_active)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (!pastMeetings.length) {
      setVoteError('❌ Nincs korábbi esemény, amihez szavazást indíthatnál.')
      return
    }
    const lastPastId = pastMeetings[0].id

    const { data, error } = await supabase
      .from('polls')
      .insert([{ past_meeting_id: lastPastId, status: 'open' }])
    if (error) {
      setVoteError('❌ Szavazás indítása sikertelen: ' + error.message)
    } else {
      setVoteSuccess('✅ Szavazás elindítva!')
      setHasOpenPoll(true)
    }
  }

  async function handleStopVoting() {
    setStopSuccess('')
    setStopError('')

    // close any open poll
    const { error } = await supabase
      .from('polls')
      .update({ status: 'complete' })
      .eq('status', 'open')

    if (error) {
      setStopError('❌ Szavazás leállítása sikertelen: ' + error.message)
    } else {
      setStopSuccess('✅ Szavazás leállítva.')
      setHasOpenPoll(false)
    }
  }


  const upcoming = meetings
    .filter((m) => m.is_active)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const past = meetings
    .filter((m) => !m.is_active)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const prevUpcoming = () => { if (upcomingIndex > 0) setUpcomingIndex(upcomingIndex - 1) }
  const nextUpcoming = () => { if (upcomingIndex < upcoming.length - 1) setUpcomingIndex(upcomingIndex + 1) }
  const prevPast     = () => { if (pastIndex < past.length - 1)   setPastIndex(pastIndex + 1) }
  const nextPast     = () => { if (pastIndex > 0)                 setPastIndex(pastIndex - 1) }

  const completeMeeting = async (id) => {
    await supabase.from('meetings').update({ is_active: false }).eq('id', id)
    await fetchMeetings()
    setUpcomingIndex(0)
    setPastIndex(0)
  }
  const revertMeeting = async (id) => {
    await supabase.from('meetings').update({ is_active: true }).eq('id', id)
    await fetchMeetings()
    setUpcomingIndex(0)
    setPastIndex(0)
  }

  // zeroed today for revert-button logic
  const today0 = new Date().setHours(0, 0, 0, 0)
  
  return (
    <Box maxW="lg" mx="auto" mt={10} px={{ base: 2, md: 6 }}>
      <Heading mb={4}>📅 Az esemény elkészítése</Heading>
      <VStack spacing={4} align="stretch">
        {/* Create Meeting Form */}
        <Select.Root
          collection={bookCollection}
          value={selectedBooks}
          onValueChange={(e) => setSelectedBooks(e.value)}
        >
          <Select.HiddenSelect aria-label="Válassz egy könyvet!" />
          <Select.Label>Készítsd el az eseményt!</Select.Label>
          <Select.Control>
            <Select.Trigger onClick={fetchAvailableBooks}>
              <Select.ValueText placeholder="Válassz egy könyvet!" />
            </Select.Trigger>
            <Select.IndicatorGroup>
              <Select.Indicator />
              <Select.ClearTrigger />
            </Select.IndicatorGroup>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {bookCollection.items.map((item) => (
                  <Select.Item key={item.value} item={item}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
        <Input placeholder="Helyszín" value={location} onChange={(e) => setLocation(e.target.value)} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <Button colorScheme="blue" onClick={handleSubmit}>Esemény elkészítése</Button>
        {success && <Text color="green.500">{success}</Text>}
        {errorMsg && <Text color="red.500">{errorMsg}</Text>}
      </VStack>

      {/* Upcoming Meetings Carousel */}
      <Heading size="md" mt={8} mb={4}>Közelgő esemény</Heading>
      {upcoming.length > 0 ? (
        <HStack>
          {upcoming.length > 1 && (
            <IconButton
              onClick={prevUpcoming}
              isDisabled={upcomingIndex === 0}
              aria-label="Régebbi közelgők"
              _disabled={{ opacity: 0.4 }}
            >
              <IoChevronBackSharp size={24} />
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
            <Text fontSize="sm">{upcoming[upcomingIndex].date} @ {upcoming[upcomingIndex].time}</Text>
            <Text fontSize="sm" color="gray.600">Helyszín: {upcoming[upcomingIndex].location}</Text>
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
              isDisabled={upcomingIndex === upcoming.length - 1}
              aria-label="Újabb közelgők"
              _disabled={{ opacity: 0.4 }}
            >
              <IoChevronForwardSharp size={24} />
            </IconButton>
          )}
        </HStack>
      ) : (
        <Text>Nincs közelgő esemény.</Text>
      )}

      {upcoming.length === 0 && (
        <Box textAlign="center" mt={6}>
          {!hasOpenPoll ? (
            <>
              <Button colorScheme="teal" onClick={handleStartVote}>
                Szavazás indítása
              </Button>
              {voteSuccess && <Text color="green.500" mt={2}>{voteSuccess}</Text>}
              {voteError   && <Text color="red.500"   mt={2}>{voteError}</Text>}
            </>
          ) : (
            <>
              <Text color="blue.600" mb={2}>Szavazás folyamatban…</Text>
              <Button colorScheme="red" onClick={handleStopVoting}>
                Szavazás leállítása
              </Button>
            </>
          )}
        </Box>
      )}

      {/* Past Meetings Carousel */}
      <Heading size="md" mt={8} mb={4}>Korábbi események</Heading>
      {past.length > 0 ? (
        <HStack>
          {past.length > 1 && (
            <IconButton
              onClick={prevPast}
              isDisabled={pastIndex < past.length - 1}
              aria-label="Régebbiek"
              opacity={pastIndex === past.length - 1 ? 0.4 : 1}
            >
              <IoChevronBackSharp size={24} />
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
            <Text fontSize="sm">{past[pastIndex].date} @ {past[pastIndex].time}</Text>
            <Text fontSize="sm" color="gray.600">Helyszín: {past[pastIndex].location}</Text>
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
              isDisabled={pastIndex === 0}
              aria-label="Újabbak"
              opacity={pastIndex === 0 ? 0.4 : 1}
            >
              <IoChevronForwardSharp size={24} />
            </IconButton>
          )}
        </HStack>
      ) : (
        <Text>Nem voltak korábbi események.</Text>
      )}
    </Box>
  )
}
