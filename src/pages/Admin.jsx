// src/pages/Admin.jsx
"use client"

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Heading,
  Input,
  VStack,
  Text,
  Portal,
  Select,
  createListCollection
} from '@chakra-ui/react'
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

  // Auto-clear success message after 3s
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  // Fetch only books not yet selected
  async function fetchAvailableBooks() {
    const { data, error } = await supabase
      .from('books')
      .select('id, title, author')
      .eq('is_selected', false)
    if (error) console.error('Failed to load books:', error)
    else setBooks(data || [])
  }

  // Fetch all meetings with their book info
  async function fetchMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, location, date, time, books(id, title, author)')
    if (error) console.error('Failed to load meetings:', error)
    else setMeetings(data || [])
  }

  useEffect(() => {
    fetchAvailableBooks()
    fetchMeetings()
  }, [])

  const bookCollection = createListCollection({
    items: books.map((b) => ({
      label: `${b.title} – ${b.author}`,
      value: b.id,
    })),
  })

  const handleSubmit = async () => {
    setSuccess('')
    setErrorMsg('')

    const bookId = selectedBooks[0]
    if (!bookId || !location || !date || !time) {
      setErrorMsg('❌ Please fill out all fields.')
      return
    }

    // 1️⃣ Create the meeting
    const { error: meetingError } = await supabase
      .from('meetings')
      .insert([{ book_id: bookId, location, date, time, notes: [] }])
    if (meetingError) {
      console.error('Insert error:', meetingError)
      setErrorMsg('❌ Failed to create meeting: ' + meetingError.message)
      return
    }

    // 2️⃣ Mark book as selected
    const { error: updateError } = await supabase
      .from('books')
      .update({ is_selected: true })
      .eq('id', bookId)
    if (updateError) {
      console.error('Failed to mark book selected:', updateError)
      setErrorMsg('❌ Meeting created but failed to select book.')
      return
    }

    // 3️⃣ Refresh lists & reset form
    setSuccess('✅ Meeting created!')
    await fetchMeetings()
    await fetchAvailableBooks()
    setSelectedBooks([])
    setLocation('')
    setDate('')
    setTime('')
  }

  return (
    <Box maxW="lg" mx="auto" mt={10}>
      <Heading mb={4}>📅 Create New Meeting</Heading>
      <VStack spacing={4} align="stretch">
        <Select.Root
          collection={bookCollection}
          value={selectedBooks}
          onValueChange={(e) => setSelectedBooks(e.value)}
        >
          <Select.HiddenSelect aria-label="Select a Book" />
          <Select.Label>Select a Book</Select.Label>
          <Select.Control>
            <Select.Trigger onClick={fetchAvailableBooks}>
              <Select.ValueText placeholder="Select a Book" />
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

        <Text fontSize="xs" color="gray.500">
          Selected book IDs: [{selectedBooks.join(', ')}]
        </Text>

        <Input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <Button colorScheme="blue" onClick={handleSubmit}>
          Create Meeting
        </Button>

        {success && <Text color="green.500">{success}</Text>}
        {errorMsg && <Text color="red.500">{errorMsg}</Text>}
      </VStack>

      <Heading size="md" mt={8} mb={4}>
        Upcoming Meetings
      </Heading>
      <VStack spacing={3} align="stretch">
        {meetings.map((m) => (
          <Box
            key={m.id}
            p={3}
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
          >
            <Text fontWeight="bold">{m.books.title}</Text>
            <Text fontSize="sm">by {m.books.author}</Text>
            <Text fontSize="sm">
              {m.date} @ {m.time}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Location: {m.location}
            </Text>
            <Button
              size="sm"
              colorScheme="red"
              mt={2}
              onClick={async () => {
                // 1️⃣ delete the meeting
                const { error: delError } = await supabase
                  .from('meetings')
                  .delete()
                  .eq('id', m.id)
                if (delError) {
                  console.error('Delete meeting failed:', delError)
                  return
                }
                // 2️⃣ mark the book as unselected
                const { error: updError } = await supabase
                  .from('books')
                  .update({ is_selected: false })
                  .eq('id', m.books.id)
                if (updError) {
                  console.error('Revert book failed:', updError)
                  return
                }
                // 3️⃣ refresh both lists
                await fetchMeetings()
                await fetchAvailableBooks()
              }}
            >
              Delete Meeting
            </Button>
          </Box>
        ))}
      </VStack>
    </Box>
  )
}
