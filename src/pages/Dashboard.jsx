import { useState, useEffect, useRef } from 'react'
import {
  Box,
  VStack,
  Image,
  IconButton,
  Text,
  Heading,
  Button,
  Textarea,
  Input,
  HStack,
  Circle
} from '@chakra-ui/react'
import { createPortal } from 'react-dom'
import { FaQuestionCircle, FaEdit, FaTrash } from 'react-icons/fa'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [meeting, setMeeting] = useState(null)
  const [questions, setQuestions] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const panelRef = useRef()

  // 1️⃣ load admin flag
  useEffect(() => {
    if (!user) return
    supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('admin lookup error', error)
        else setIsAdmin(data?.is_admin)
      })
  }, [user])

  // 2️⃣ fetch next meeting (notes live on meetings table)
  useEffect(() => {
    async function loadMeeting() {
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          id,
          date,
          time,
          location,
          notes,
          books (
            id,
            title,
            cover_url
          )
        `)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(1)
        .single()

      if (error) {
        console.error('Failed to load meeting:', error)
        setMeeting(null)
      } else {
        setMeeting(data)
        setQuestions(data.notes || [])
      }
    }
    loadMeeting()
  }, [])

  if (!meeting) {
    return (
      <Box textAlign="center" mt="20">
        <Text>No upcoming meeting.</Text>
      </Box>
    )
  }

  const book = meeting.books

  // 3️⃣ Add a new question
  const addQuestion = async () => {
    const text = newQuestion.trim()
    if (!text) return
    const q = {
      id: Date.now(),
      user_id: user.id,
      user_name: user.user_metadata?.display_name || '',
      text
    }
    const updated = [...questions, q]
    const { error } = await supabase
      .from('meetings')
      .update({ notes: updated })
      .eq('id', meeting.id)
    if (error) console.error('addQuestion error', error)
    else {
      setQuestions(updated)
      setNewQuestion('')
    }
  }

  // 4️⃣ Start editing an existing question
  const startEdit = (q) => {
    setEditingId(q.id)
    setEditingText(q.text)
  }
  // 5️⃣ Save an edit
  const saveEdit = async () => {
    const updated = questions.map((q) =>
      q.id === editingId ? { ...q, text: editingText } : q
    )
    const { error } = await supabase
      .from('meetings')
      .update({ notes: updated })
      .eq('id', meeting.id)
    if (error) console.error('saveEdit error', error)
    else {
      setQuestions(updated)
      setEditingId(null)
    }
  }

  // 6️⃣ Delete a question
  const deleteQuestion = async (qid) => {
    const updated = questions.filter((q) => q.id !== qid)
    const { error } = await supabase
      .from('meetings')
      .update({ notes: updated })
      .eq('id', meeting.id)
    if (error) console.error('deleteQuestion error', error)
    else setQuestions(updated)
  }

  // 7️⃣ The floating questions panel
  const panel = (
    <Box
      ref={panelRef}
      position="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      bg="white"
      p="6"
      boxShadow="2xl"
      borderRadius="md"
      zIndex={1000}
      width="320px"
    >
      <Heading size="md" mb="4">Questions</Heading>
      <VStack spacing="3" align="stretch">
        {questions.map((q) => (
          <Box key={q.id} p="2" border="1px solid" borderRadius="md">
            {editingId === q.id ? (
              <VStack spacing="2">
                <Input
                  size="sm"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                />
                <Button size="sm" onClick={saveEdit}>
                  Save
                </Button>
              </VStack>
            ) : (
              <VStack align="stretch">
                <Text>
                  {q.text}{' '}
                  <Text as="span" fontSize="xs" color="gray.500">
                    — {q.user_name}
                  </Text>
                </Text>
                {(isAdmin || q.user_id === user.id) && (
                  <HStack spacing="2">
                    <IconButton
                      size="xs"
                      onClick={() => startEdit(q)}
                      aria-label="Edit question"
                      variant="ghost"
                    >
                      <FaEdit />
                    </IconButton>
                    <IconButton
                      size="xs"
                      onClick={() => deleteQuestion(q.id)}
                      aria-label="Delete question"
                      variant="ghost"
                    >
                      <FaTrash />
                    </IconButton>
                  </HStack>
                )}
              </VStack>
            )}
          </Box>
        ))}

        <Box display="flex" gap="2" mt="4">
          <Textarea
            size="sm"
            placeholder="Your question…"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
          />
          <Button onClick={addQuestion}>Add</Button>
        </Box>
        <Button variant="ghost" onClick={() => setShowPanel(false)}>
          Close
        </Button>
      </VStack>
    </Box>
  )

  return (
    <Box textAlign="center" mt="10">
      <Heading mb="4">{book.title}</Heading>
      <Box position="relative" display="inline-block">
        <Image
          src={book.cover_url}
          boxSize="300px"
          objectFit="cover"
          borderRadius="md"
        />

        <Circle
          size="36px"
          bg="white"
          position="absolute"
          bottom="4"
          right="4"
          cursor="pointer"
          onClick={() => setShowPanel((v) => !v)}
        >
          <Text fontSize="24px" fontWeight="bold" lineHeight="1" color="black">
            ?
          </Text>
        </Circle>
      </Box>

      <VStack mt="4">
        <Text>Date: {meeting.date}</Text>
        <Text>Time: {meeting.time}</Text>
        <Text>Location: {meeting.location}</Text>
      </VStack>

      {showPanel && createPortal(panel, document.body)}
    </Box>
  )
}