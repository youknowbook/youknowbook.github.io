import { useState, useEffect } from 'react'
import {
  Box, Button, Heading, Input, VStack, Select, Text
} from '@chakra-ui/react'
import { supabase } from '../api/supabaseClient'

export default function Admin() {
  const [books, setBooks] = useState([])
  const [bookId, setBookId] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [success, setSuccess] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadBooks() {
      const { data, error } = await supabase.from('books').select('*')
      if (error) {
        console.error('Failed to load books:', error)
      } else {
        setBooks(data)
      }
    }
    loadBooks()
  }, [])

  const handleSubmit = async () => {
    setSuccess('')
    setErrorMsg('')

    if (!bookId || !location || !date || !time) {
      setErrorMsg('❌ Please fill out all fields.')
      return
    }

    const { error } = await supabase.from('meetings').insert({
      book_id: bookId,
      location,
      date,
      time,
    })

    if (error) {
      console.error('Insert error:', error)
      setErrorMsg('❌ Failed to create meeting: ' + error.message)
    } else {
      setSuccess('✅ Meeting created!')
      setBookId('')
      setLocation('')
      setDate('')
      setTime('')
    }
  }

  console.log("✅ Rendering Admin page...");

  return (
    <Box maxW="lg" mx="auto" mt={10}>
      <Heading mb={4}>📅 Create New Meeting</Heading>
      <VStack spacing={4} align="stretch">
        <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.375rem', borderColor: '#CBD5E0' }}
            >
            <option value="">Select a Book</option>
            {books.map((book) => (
                <option key={book.id} value={book.id}>
                {book.title} – {book.author}
                </option>
            ))}
        </select>

        <Input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />

        <Button colorScheme="blue" onClick={handleSubmit}>
          Create Meeting
        </Button>

        {success && <Text color="green.500">{success}</Text>}
        {errorMsg && <Text color="red.500">{errorMsg}</Text>}
      </VStack>
    </Box>
  )
}
