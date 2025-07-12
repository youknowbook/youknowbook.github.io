import React, { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  Box,
  VStack,
  HStack,
  Image,
  Text,
  Heading,
  Button,
  Circle,
  Avatar,
  AvatarGroup,
  Link,
  Portal,
  Menu,
  IconButton,
  Textarea,
  Input
} from '@chakra-ui/react'
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaChevronDown,
  FaQuestionCircle,
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaArrowRight
} from 'react-icons/fa'
import { createPortal } from 'react-dom'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Helper to average an array of hex colors
function averageHex(colors) {
  if (!colors.length) return '#ffffff'
  const total = colors.reduce(
    (acc, hex) => {
      const v = parseInt(hex.replace('#', ''), 16)
      acc.r += (v >> 16) & 0xff
      acc.g += (v >> 8) & 0xff
      acc.b += v & 0xff
      return acc
    },
    { r: 0, g: 0, b: 0 }
  )
  const n = colors.length
  const r = Math.round(total.r / n)
  const g = Math.round(total.g / n)
  const b = Math.round(total.b / n)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)}`
}

// Build CSS background based on combination method
function buildBackground(colors, method, ownColor) {
  if (!colors.length || method === 'Colorless') return '#ffffff'
  if (method === 'Saját szín') return ownColor || '#ffffff'
  if (method === 'Kevert szín') return averageHex(colors)
  if (method === 'Körkörös') return `radial-gradient(circle, ${colors.join(',')})`
  const stripeSize = 100 / colors.length
  const stops = colors.map((c, i) => `${c} ${i * stripeSize}% ${(i + 1) * stripeSize}%`).join(', ')
  return `repeating-linear-gradient(90deg, ${stops})`
}

export default function Dashboard() {
  const { user } = useAuth()

  // Meeting cycling state
  const [meetings, setMeetings] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const meeting = meetings[currentIdx] || null

  // Other states
  const [isAdmin, setIsAdmin] = useState(false)
  const [questions, setQuestions] = useState([])
  const [showQ, setShowQ] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const qRef = useRef()
  const [allColors, setAllColors] = useState([])
  const [ownColor, setOwnColor] = useState(null)
  const [method, setMethod] = useState('Stack')
  const [attendees, setAttendees] = useState([])
  const [isAttending, setIsAttending] = useState(false)
  const [showAtt, setShowAtt] = useState(false)

  // Parse helper
  const parseNotes = raw => raw.map(item => (typeof item === 'string' ? JSON.parse(item) : item))

  // Load meetings
  useEffect(() => {
    async function fetchMeetings() {
      const { data, error } = await supabase
        .from('meetings')
        .select('id,date,time,location,notes,attendees,books(id,title,cover_url)')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      if (error || !data.length) return
      setMeetings(data)
      const nextIdx = data.findIndex(m => new Date(m.date) >= new Date())
      setCurrentIdx(nextIdx >= 0 ? nextIdx : data.length - 1)
    }
    fetchMeetings()
  }, [user])

  // Load meeting details
  useEffect(() => {
    if (!user) return
    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => setIsAdmin(data?.is_admin || false))
    if (!meeting) return
    ;(async () => {
      // Questions
      const raw = parseNotes(meeting.notes)
      const uids = [...new Set(raw.map(q => q.user_id))].filter(Boolean)
      const nameMap = {}
      if (uids.length) {
        const { data: users } = await supabase.from('users').select('id,display_name').in('id', uids)
        users.forEach(u => nameMap[u.id] = u.display_name)
      }
      setQuestions(raw.map(q => ({ ...q, user_name: q.user_name || nameMap[q.user_id] || 'Unknown' })))

      // Colors
      const { data: ub } = await supabase.from('user_books').select('user_id,mood_color').eq('book_id', meeting.books.id)
      const cols = (ub || []).map(r => r.mood_color.startsWith('#') ? r.mood_color : `#${r.mood_color}`)
      setAllColors(cols)
      const meRec = ub?.find(r => r.user_id === user.id)
      setOwnColor(meRec ? (meRec.mood_color.startsWith('#') ? meRec.mood_color : `#${meRec.mood_color}`) : null)

      // Attendees
      const aIds = Array.isArray(meeting.attendees) ? meeting.attendees : []
      if (aIds.length) {
        const { data: us } = await supabase.from('users').select('id,display_name,profile_picture').in('id', aIds)
        setAttendees(us)
        setIsAttending(aIds.includes(user.id))
      } else {
        setAttendees([])
        setIsAttending(false)
      }
    })()
  }, [user, meeting])

  // Navigation
  const prev = () => setCurrentIdx(i => Math.max(i - 1, 0))
  const next = () => setCurrentIdx(i => Math.min(i + 1, meetings.length - 1))

  if (!meeting) return (<Box textAlign="center" mt="20"><Text>Nincs még bejelentett találkozó.</Text></Box>)

  const { books: book, date, time, location } = meeting
  const bg = buildBackground(allColors, method, ownColor)

  // Question management
  const startEdit = q => { setEditId(q.id); setEditText(q.text) }
  const saveEdit = async () => {
    const updated = questions.map(q => q.id === editId ? { ...q, text: editText } : q)
    const { data: res } = await supabase.from('meetings').update({ notes: updated }).eq('id', meeting.id).select('notes').single()
    setQuestions(parseNotes(res.notes)); setEditId(null)
  }
  const deleteQuestion = async id => {
    const updated = questions.filter(q => q.id !== id)
    const { data: res } = await supabase.from('meetings').update({ notes: updated }).eq('id', meeting.id).select('notes').single()
    setQuestions(parseNotes(res.notes))
  }
  const addQ = async () => {
    const txt = newQ.trim()
    if (!txt) return
    let dn = user.user_metadata?.display_name || ''
    if (!dn) {
      const { data: me } = await supabase.from('users').select('display_name').eq('id', user.id).single()
      dn = me.display_name
    }
    const note = { id: uuidv4(), user_id: user.id, user_name: dn, text: txt }
    const { data: res } = await supabase.from('meetings').update({ notes: [...questions, note] }).eq('id', meeting.id).select('notes').single()
    setQuestions(parseNotes(res.notes)); setNewQ('')
  }

  // RSVP toggle
  const toggleAttend = async () => {
    const curr = meeting.attendees || []
    const newIds = isAttending
      ? curr.filter(id => id !== user.id)
      : [...curr, user.id]

    // 1) Persist to DB
    const { data: updatedMeeting, error } = await supabase
      .from('meetings')
      .update({ attendees: newIds })
      .eq('id', meeting.id)
      .select('attendees')
      .single()
    if (error) return console.error('RSVP update failed', error)

    const ids = updatedMeeting.attendees || []

    // 2) Update our meetings list so the current `meeting` object has the new IDs
    setMeetings(ms =>
      ms.map(m => (m.id === meeting.id ? { ...m, attendees: ids } : m))
    )
    setIsAttending(ids.includes(user.id))

    // 3) Fetch user profiles for the new list of IDs
    if (ids.length) {
      const { data: profiles, error: pe } = await supabase
        .from('users')
        .select('id,display_name,profile_picture')
        .in('id', ids)
      if (pe) {
        console.error('Failed to load attendee profiles', pe)
        setAttendees([])
      } else {
        setAttendees(profiles)
      }
    } else {
      setAttendees([])
    }
  }

  // Google Calendar link
  const [hour, minute] = time.split(':').map(Number)
  const startStamp = date.replace(/-/g, '') +
  'T' + String(hour).padStart(2,'0') + String(minute).padStart(2,'0') + '00'
  const totalMins = hour * 60 + minute + 90
  const endH = String(Math.floor(totalMins / 60) % 24).padStart(2, '0')
  const endM = String(totalMins % 60).padStart(2, '0')
  const endStamp = date.replace(/-/g, '') + 'T' + endH + endM + '00'
  const gc = new URL('https://calendar.google.com/calendar/render')
  gc.searchParams.set('action','TEMPLATE')
  gc.searchParams.set('text',`you-know-book: ${book.title}`)
  gc.searchParams.set('dates',`${startStamp}/${endStamp}`)
  gc.searchParams.set('details',`Location: ${location}`)
  gc.searchParams.set('location', location)

  // Questions panel
  const panel = (
    <Box ref={qRef} pos="fixed" top="50%" left="50%" transform="translate(-50%,-50%)" bg="white" p="6" boxShadow="2xl" borderRadius="md" zIndex={1000} w="320px" onClick={e=>e.stopPropagation()}>
      <Heading size="md" mb="4">Kérdések</Heading>
      <VStack spacing="3" align="stretch">
        {questions.map((q,i) => (
          <Box key={q.id} p="2" border="1px solid" borderRadius="md">
            {editId===q.id ? (
              <VStack spacing="2">
                <Input size="sm" value={editText} onChange={e=>setEditText(e.target.value)} />
                <Button size="sm" onClick={saveEdit}>Mentés</Button>
              </VStack>
            ) : (
              <VStack align="stretch">
                <Text>{q.text} <Text as="span" fontSize="xs" color="gray.500">— {q.user_name}</Text></Text>
                {(isAdmin||q.user_id===user.id)&&(
                  <HStack spacing="2">
                    <IconButton size="xs" variant="ghost" aria-label="Szerkeszt" onClick={()=>startEdit(q)}><FaEdit/></IconButton>
                    <IconButton size="xs" variant="ghost" aria-label="Töröl" onClick={()=>deleteQuestion(q.id)}><FaTrash/></IconButton>
                  </HStack>
                )}
              </VStack>
            )}
          </Box>
        ))}
        <Box display="flex" gap="2" mt="4">
          <Textarea size="sm" placeholder="A kérdésed…" value={newQ} onChange={e=>setNewQ(e.target.value)} />
          <Button onClick={addQ}>Hozzáad</Button>
        </Box>
        <Button variant="ghost" onClick={()=>setShowQ(false)}>Bezár</Button>
      </VStack>
    </Box>
  )

    return (
    <VStack spacing="8" mt="10" px="6" align="center">
      {/* Navigation arrows around cover */}
      <Box w="full" maxW="md" position="relative">
        {/* Colored cover panel with cycling arrows overlay */}
        <Box
          bg={bg}
          p="4"
          borderRadius="md"
          boxShadow="md"
          display="flex"
          justifyContent="center"
          position="relative"
        >
          <IconButton
            pos="absolute"
            top="50%"
            left="4"
            transform="translateY(-50%)"
            onClick={prev}
            isDisabled={currentIdx === 0}
            aria-label="Előző esemény"
            opacity={currentIdx === 0 ? 0.4 : 1}
            variant="ghost"
            size="lg"
          >
            <FaArrowLeft size={24} />
          </IconButton>

          <Image
            src={book.cover_url}
            boxSize="300px"
            objectFit="cover"
            borderRadius="md"
          />

          {/* Color menu */}
          {allColors.length > 0 && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Circle
                  size="36px"
                  bg="white"
                  pos="absolute"
                  top="4"
                  right="4"
                  cursor="pointer"
                >
                  <FaChevronDown />
                </Circle>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {['Sávok', 'Körkörös', 'Kevert', 'Színtelen'].map(opt => (
                      <Menu.Item key={opt} onClick={() => setMethod(opt)}>
                        {opt}
                      </Menu.Item>
                    ))}
                    {ownColor && (
                      <Menu.Item onClick={() => setMethod('Saját szín')}>
                        Saját szín
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}

          {/* Questions toggle */}
          <Circle
            size="36px"
            bg="white"
            pos="absolute"
            bottom="4"
            right="4"
            cursor="pointer"
            onClick={() => setShowQ(v => !v)}
          >
            <FaQuestionCircle size="24" />
          </Circle>
          {showQ &&
            createPortal(
              <Box
                pos="fixed"
                inset={0}
                bg="blackAlpha.600"
                zIndex={999}
                onClick={() => setShowQ(false)}
              >
                {panel}
              </Box>,
              document.body
            )}

          <IconButton
            pos="absolute"
            top="50%"
            right="4"
            transform="translateY(-50%)"
            onClick={next}
            isDisabled={currentIdx === meetings.length - 1}
            aria-label="Következő esemény"
            opacity={currentIdx === meetings.length - 1 ? 0.4 : 1}
            variant="ghost"
            size="lg"
          >
            <FaArrowRight size={24} />
          </IconButton>
        </Box>
      </Box>

      {/* Meeting details card */}
      <Box w="full" maxW="md" bg="white" boxShadow="md" borderRadius="md" p="6">
        <VStack align="start" spacing="4">
          <Heading size="md">{book.title}</Heading>
          <Text><strong>Dátum:</strong> {date}</Text>
          <Text><strong>Idő:</strong> {time.slice(0,5)}</Text>
          <Text><strong>Helyszín:</strong> {location}</Text>

          <HStack spacing="3" pt="4">
            <Button
              leftIcon={<FaCalendarAlt />}
              as={Link}
              href={gc.toString()}
              isExternal
            >
              Hozzáadás a naptáradhoz
            </Button>
            <Button
              leftIcon={<FaMapMarkerAlt />}
              as={Link}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                location
              )}`}
              isExternal
            >
              Mutasd a térképen
            </Button>
          </HStack>

          <HStack spacing="3" pt="4" align="center">
            <Button
              colorScheme={isAttending ? 'green' : 'gray'}
              onClick={toggleAttend}
            >
              {isAttending ? 'Mégsem jövök' : "Jövök"}
            </Button>

            <AvatarGroup spacing="-3">
              {attendees.slice(0, 3).map(u => (
                <Avatar.Root size="sm" key={u.id}>
                  <Avatar.Fallback name={u.display_name} />
                  <Avatar.Image src={u.profile_picture} />
                </Avatar.Root>
              ))}
              {attendees.length > 3 && (
                <Avatar.Root size="sm">
                  <Avatar.Fallback name={`+${attendees.length - 3}`} />
                </Avatar.Root>
              )}
            </AvatarGroup>
            <Button variant="link" onClick={() => setShowAtt(true)}>
              Akik jönnek
            </Button>
          </HStack>
        </VStack>
      </Box>

      {/* Attendees overlay */}
      {showAtt &&
        createPortal(
          <Box
            pos="fixed"
            inset={0}
            bg="blackAlpha.600"
            zIndex={1000}
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={() => setShowAtt(false)}
          >
            <Box
              bg="white"
              borderRadius="md"
              w="90%"
              maxW="xs"
              p="6"
              onClick={e => e.stopPropagation()}
            >
              <VStack align="start" spacing="4">
                <HStack justify="space-between" w="full">
                  <Heading size="sm">Résztvevők ({attendees.length})</Heading>
                  <Button size="sm" onClick={() => setShowAtt(false)}>
                    Bezárás
                  </Button>
                </HStack>
                <AvatarGroup spacing="4">
                  {attendees.map(u => (
                    <VStack key={u.id} spacing="1" align="center">
                      <Avatar.Root size="md">
                        <Avatar.Fallback name={u.display_name} />
                        <Avatar.Image src={u.profile_picture} />
                      </Avatar.Root>
                      <Text fontSize="sm" noOfLines={1}>
                        {u.display_name}
                      </Text>
                    </VStack>
                  ))}
                </AvatarGroup>
              </VStack>
            </Box>
          </Box>,
          document.body
        )}
    </VStack>
  )
}
