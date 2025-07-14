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
  Input,
  Wrap,
  WrapItem,
  Group, 
} from '@chakra-ui/react'
import {
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaChevronDown,
  FaQuestionCircle,
  FaEdit,
  FaTrash,
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaTimes
} from 'react-icons/fa'
import { createPortal } from 'react-dom'
import { supabase } from '../api/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Voting from '../components/Dashboard/Voting'
import MeetingTime from '../components/Dashboard/MeetingTime'

// Helper to average an array of hex colors
function averageHex(colors) {
  if (!colors.length) return '#ffffff'
  const total = colors.reduce((acc, hex) => {
    const v = parseInt(hex.replace('#', ''), 16)
    acc.r += (v >> 16) & 0xff
    acc.g += (v >> 8) & 0xff
    acc.b += v & 0xff
    return acc
  }, { r: 0, g: 0, b: 0 })
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
  if (!colors.length || method === 'Színtelen') return '#ffffff'
  if (method === 'Saját szín') return ownColor || '#ffffff'
  if (method === 'Kevert') return averageHex(colors)
  if (method === 'Körkörös') return `radial-gradient(circle, ${colors.join(',')})`
  if (method === 'Sávok') {
    // at least 10 stripes, blending between each adjacent color
    const repeats = 10;
    const size = 100 / repeats;
    const stops = Array.from({ length: repeats }, (_, i) => {
      const c1 = colors[i % colors.length];
      const c2 = colors[(i + 1) % colors.length];
      const start = i * size;
      const mid = start + size / 2;
      const end = start + size;
      return `${c1} ${start}%, ${c2} ${mid}%, ${c2} ${end}%`;
    }).join(', ');
    return `linear-gradient(90deg, ${stops})`;
  }

  // fallback
  return '#ffffff'
}

export default function Dashboard() {
  const { user } = useAuth()

  // raw meetings & current index
  const [meetings, setMeetings] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)

  // Compute placeholder logic
  const activeMeetings = meetings.filter((m) => m.is_active)
  const noActive = activeMeetings.length === 0

  // show placeholder as the latest (end) when no upcoming
  const displayMeetings = noActive
    ? [...meetings, { placeholder: true }]
    : meetings

  const meeting = displayMeetings[currentIdx] || {}

  // Other component state
  const [isAdmin, setIsAdmin] = useState(false)
  const [questions, setQuestions] = useState([])
  const [showQ, setShowQ] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')
  const qRef = useRef()
  const [allColors, setAllColors] = useState([])
  const [ownColor, setOwnColor] = useState(null)
  const [method, setMethod] = useState('Sávok')
  const [attendees, setAttendees] = useState([])
  const [isAttending, setIsAttending] = useState(false)
  const [showAtt, setShowAtt] = useState(false)
  const [showVoting, setShowVoting] = useState(false)
  const [openPoll, setOpenPoll] = useState(false) 
  const [showMeetingTime, setShowMeetingTime] = useState(false)

  const today = new Date()
  const defaultYear = today.getFullYear()
  const defaultMonth = today.getMonth() + 1

  const [openRoundId, setOpenRoundId] = useState(null)

  useEffect(() => {
    // grab the single open date‐selection round, if any
    supabase
      .from('date_selection_rounds')
      .select('id')
      .eq('status', 'open')
      .single()
      .then(({ data, error }) => {
        if (!error && data?.id) {
          setOpenRoundId(data.id)
        }
      })
  }, [])

  // Helper to parse stored notes
  const parseNotes = (raw) =>
    raw.map((item) => (typeof item === 'string' ? JSON.parse(item) : item))

  // ---- new: do we have a poll started? ---- 
    useEffect(() => { 
      async function fetchOpenPoll() { 
        const { data, error } = await supabase 
          .from('polls') 
          .select('id') 
          .eq('status', 'open') 
          .single() 
        setOpenPoll(!!data) 
      } 
      fetchOpenPoll() 
    }, [])

  // Fetch meetings (with is_active) and init currentIdx
  useEffect(() => {
    async function fetchMeetings() {
      const { data, error } = await supabase
        .from('meetings')
        .select(
          'id, date, time, location, notes, attendees, is_active, books(id, title, cover_url)'
        )
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      if (error || !data.length) return
      setMeetings(data)
      const idx = data.findIndex((m) => m.is_active)
      // if none active, start on the appended placeholder slot at index = data.length
      setCurrentIdx(idx >= 0 ? idx : data.length)
    }
    fetchMeetings()
  }, [user])

  // Load details (questions, colors, attendees) when `meeting` changes
  useEffect(() => {
    if (!user || !meeting || meeting.placeholder) return;

    (async () => {
      // --- Questions ---
      const raw = parseNotes(meeting.notes);
      const uids = [...new Set(raw.map((q) => q.user_id))].filter(Boolean);
      const nameMap = {};
      if (uids.length) {
        const { data: users } = await supabase
          .from('users')
          .select('id, display_name')
          .in('id', uids);
        users.forEach((u) => {
          nameMap[u.id] = u.display_name;
        });
      }
      setQuestions(
        raw.map((q) => ({
          ...q,
          user_name: q.user_name || nameMap[q.user_id] || 'Unknown',
        }))
      );

      // --- Public colors for stripes / gradients / mix ---
      const { data: publicBooks, error: pubErr } = await supabase
        .from('user_books_public')
        .select('user_id, mood_color')
        .eq('book_id', meeting.books.id);
      if (pubErr) {
        console.error('Failed to load public mood colors', pubErr);
      }
      // Map and filter out any pure white entries
      const all = (publicBooks || [])
        .map(r => {
          const raw = r.mood_color.trim().toLowerCase();
          return raw.startsWith('#') ? raw : `#${raw}`;
        })
        .filter(c => c !== '#ffffff');

      console.log('allColors (filtered):', all);
      setAllColors(all);

      // --- Your own color ---
      const mine = publicBooks?.find((r) => r.user_id === user.id);
      const own = mine
        ? mine.mood_color.startsWith('#')
          ? mine.mood_color
          : `#${mine.mood_color}`
        : null;
      console.log('ownColor:', own);
      setOwnColor(own);

      // --- Your saved display setting ---
      const {
        data: myRow,
        error: myErr,
      } = await supabase
        .from('user_books')
        .select('mood_color_setting')
        .match({ user_id: user.id, book_id: meeting.books.id })
        .single();
      if (myErr && myErr.code !== 'PGRST116') {
        console.error('Failed to load your color setting', myErr);
      }
      if (myRow?.mood_color_setting) {
        setMethod(myRow.mood_color_setting);
      }

      // --- Attendees ---
      const aIds = Array.isArray(meeting.attendees)
        ? meeting.attendees
        : [];
      if (aIds.length) {
        const { data: us } = await supabase
          .from('users')
          .select('id, display_name, profile_picture')
          .in('id', aIds);
        setAttendees(us);
        setIsAttending(aIds.includes(user.id));
      } else {
        setAttendees([]);
        setIsAttending(false);
      }
    })();
  }, [user, meeting]);

  // Split Avatars
  const partition = (arr, max) => {
    const items = []
    const overflow = []
    for (const item of arr) {
      if (items.length < max) items.push(item)
      else overflow.push(item)
    }
    return { items, overflow }
  }

  const maxAvatars = meeting.is_active ? 3 : 8
  const { items, overflow } = partition(attendees, maxAvatars)

  // Navigation
  const prev = () =>
    setCurrentIdx((i) => Math.max(i - 1, 0))
  const next = () =>
    setCurrentIdx((i) =>
      Math.min(i + 1, displayMeetings.length - 1)
    )

  // Destructure details only if not placeholder
  let book, date, time, location
  if (!meeting.placeholder) {
    book = meeting.books
    date = meeting.date
    time = meeting.time
    location = meeting.location
  }

  // in your render, *before* the JSX:
  const rawBg = buildBackground(allColors, method, ownColor)
  // detect if it’s a gradient string
  const isGradient = rawBg.startsWith('linear-') 
                  || rawBg.startsWith('radial-') 
                  || rawBg.includes('gradient(')

  console.log(`Dashboard bg — method: ${method}; rawBg: ${rawBg}; gradientMode: ${isGradient}`)

  // Question‐panel handlers
  const startEdit = (q) => {
    setEditId(q.id)
    setEditText(q.text)
  }
  const saveEdit = async () => {
    const updated = questions.map((q) =>
      q.id === editId ? { ...q, text: editText } : q
    )
    const { data: res } = await supabase
      .from('meetings')
      .update({ notes: updated })
      .eq('id', meeting.id)
      .select('notes')
      .single()
    setQuestions(parseNotes(res.notes))
    setEditId(null)
  }
  const deleteQuestion = async (id) => {
    const updated = questions.filter((q) => q.id !== id)
    const { data: res } = await supabase
      .from('meetings')
      .update({ notes: updated })
      .eq('id', meeting.id)
      .select('notes')
      .single()
    setQuestions(parseNotes(res.notes))
  }
  const addQ = async () => {
    const txt = newQ.trim()
    if (!txt) return
    let dn = user.user_metadata?.display_name || ''
    if (!dn) {
      const { data: me } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()
      dn = me.display_name
    }
    const note = {
      id: uuidv4(),
      user_id: user.id,
      user_name: dn,
      text: txt
    }
    const { data: res } = await supabase
      .from('meetings')
      .update({ notes: [...questions, note] })
      .eq('id', meeting.id)
      .select('notes')
      .single()
    setQuestions(parseNotes(res.notes))
    setNewQ('')
  }

  // RSVP toggle
  const toggleAttend = async () => {
    const curr = meeting.attendees || []
    const newIds = isAttending
      ? curr.filter((id) => id !== user.id)
      : [...curr, user.id]
    const { data: updatedMeeting, error } = await supabase
      .from('meetings')
      .update({ attendees: newIds })
      .eq('id', meeting.id)
      .select('attendees')
      .single()
    if (error) return console.error('RSVP update failed', error)
    const ids = updatedMeeting.attendees || []
    setMeetings((ms) =>
      ms.map((m) =>
        m.id === meeting.id ? { ...m, attendees: ids } : m
      )
    )
    setIsAttending(ids.includes(user.id))
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

  // Google Calendar link (only for real meetings)
  let gc
  if (!meeting.placeholder) {
    const [hour, minute] = time.split(':').map(Number)
    const startStamp =
      date.replace(/-/g, '') +
      'T' +
      String(hour).padStart(2, '0') +
      String(minute).padStart(2, '0') +
      '00'
    const totalMins = hour * 60 + minute + 90
    const endH = String(Math.floor(totalMins / 60) % 24).padStart(
      2,
      '0'
    )
    const endM = String(totalMins % 60).padStart(2, '0')
    const endStamp =
      date.replace(/-/g, '') + 'T' + endH + endM + '00'
    gc = new URL('https://calendar.google.com/calendar/render')
    gc.searchParams.set('action', 'TEMPLATE')
    gc.searchParams.set('text', `you-know-book: ${book.title}`)
    gc.searchParams.set('dates', `${startStamp}/${endStamp}`)
    gc.searchParams.set(
      'details',
      `Location: ${location}`
    )
    gc.searchParams.set('location', location)
  }

  // Questions overlay panel
  const panel = (
    <Box
      ref={qRef}
      pos="fixed"
      top="50%"
      left="50%"
      transform="translate(-50%,-50%)"
      bg="white"
      p="6"
      boxShadow="2xl"
      borderRadius="md"
      zIndex={1000}
      w="320px"
      onClick={(e) => e.stopPropagation()}
    >
      <Heading size="md" mb="4">
        Kérdések
      </Heading>
      <VStack spacing="3" align="stretch">
        {questions.map((q) => (
          <Box key={q.id} p="2" border="1px solid" borderRadius="md">
            {/* only allow editing mode if meeting is active */}
            {editId === q.id && meeting.is_active ? (
              <VStack spacing="2">
                <Input size="sm" value={editText} onChange={e => setEditText(e.target.value)} />
                <Button size="sm" onClick={saveEdit}>Mentés</Button>
              </VStack>
            ) : (
              <VStack align="stretch">
                <Text>
                  {q.text} <Text as="span" fontSize="xs" color="gray.500">— {q.user_name}</Text>
                </Text>
                {/* only show edit/delete if meeting is active */}
                {meeting.is_active && (isAdmin || q.user_id === user.id) && (
                  <HStack spacing="2">
                    <IconButton size="xs" variant="ghost" aria-label="Szerkeszt" onClick={() => startEdit(q)}><FaEdit/></IconButton>
                    <IconButton size="xs" variant="ghost" aria-label="Töröl" onClick={() => deleteQuestion(q.id)}><FaTrash/></IconButton>
                  </HStack>
                )}
              </VStack>
            )}
          </Box>
        ))}
        {meeting.is_active && (
          <Box display="flex" gap="2" mt="4">
            <Textarea
              size="sm"
              placeholder="A kérdésed…"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
            />
            <Button onClick={addQ}>Hozzáad</Button>
          </Box>
        )}
        <Button
          variant="ghost"
          onClick={() => setShowQ(false)}
        >
          Bezár
        </Button>
      </VStack>
    </Box>
  )

  // Voting component
  if (showVoting) {
    return (
      <Box position="relative" minH="100vh" p="6">
        <Voting onClose={() => setShowVoting(false)} />
      </Box>
    )
  }

  if (showMeetingTime) {
    return (
      <Box position="relative" minH="100vh" p="6">
        <IconButton
          aria-label="Bezár"
          onClick={() => setShowMeetingTime(false)}
          position="absolute"
          top="4"
          right="4"
          variant="ghost"
          size="lg"
        >
          <FaTimes />
        </IconButton>
        <Heading size="lg" textAlign="center" mb={6}>
          Jelöld meg a számodra megfelelő napokat
        </Heading>
        <MeetingTime
          year={defaultYear}
          month={defaultMonth}
          roundId={openRoundId}
          initialParticipants={{}}
          onChange={(updated) => {
            console.log('Calendar RSVPs:', updated)
          }}
        />
      </Box>
    )
  }

  async function onChangeMode(newMode) {
    setMethod(newMode)

    const { error } = await supabase
      .from('user_books')
      .update({ mood_color_setting: newMode })
      .match({
        user_id: user.id,
        book_id: meeting.books.id
      })

    if (error) console.error('Could not save color setting', error)
  }

  return (
    <VStack spacing="8" mt="10" px="6" align="center">
      {/* Cover + arrows */}
      <Box w="full" maxW="md" position="relative">
        <Box
          // only feed pure gradients into backgroundImage
          backgroundImage={isGradient ? rawBg : undefined}
          // feed solid colors (#xxxxxx) into bg
          bg={!isGradient ? rawBg : undefined}
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
            opacity={currentIdx === 0 ? 0.4 : 0.9}
            rounded="full"
            bg="white"
            size="lg"
          >
            <FaArrowLeft color="black" size={24} />
          </IconButton>

          {meeting.placeholder ? (
            <Box
              boxSize="300px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="gray.100"
              borderRadius="md"
            >
              {openPoll ? (
                <Button
                  colorScheme="teal"
                  size="lg"
                  onClick={() => setShowVoting(true)}
                >
                  Szavazás
                </Button>
              ) : (
                <Text>Nincs még könyv</Text>
              )}
            </Box>
          ) : (
            <Image
              src={book.cover_url}
              boxSize="300px"
              objectFit="cover"
              borderRadius="md"
            />
          )}

          {!meeting.placeholder && allColors.length > 0 && (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Circle size="36px" bg="white" pos="absolute" top="4" right="4" cursor="pointer">
                  <FaChevronDown />
                </Circle>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    {['Sávok', 'Körkörös', 'Kevert', 'Színtelen'].map(opt => (
                      <Menu.Item
                        key={opt}
                        onClick={() => onChangeMode(opt)}
                        icon={method === opt ? <FaCheck /> : undefined}
                      >
                        {opt}
                      </Menu.Item>
                    ))}
                    {ownColor && (
                      <Menu.Item
                        onClick={() => onChangeMode('Saját szín')}
                        icon={method === 'Saját szín' ? <FaCheck /> : undefined}
                      >
                        Saját szín
                      </Menu.Item>
                    )}
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          )}

          {!meeting.placeholder && (
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
          )}
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
            isDisabled={
              currentIdx === displayMeetings.length - 1
            }
            aria-label="Következő esemény"
            opacity={
              currentIdx ===
              displayMeetings.length - 1
                ? 0.4
                : 0.9
            }
            rounded="full"
            size="lg"
            bg="white"
          >
            <FaArrowRight color="black" size={24} />
          </IconButton>
        </Box>
      </Box>

      {/* Details */}
      <Box justifyItems="center" w="full" maxW="md" bg="white" boxShadow="md" borderRadius="md" p="6">
        <VStack align="start" spacing="4">
          {meeting.placeholder ? (
            // No upcoming meeting
            <Box textAlign="center" py={8}>
              <Button
                size="md"
                colorScheme="teal"
                leftIcon={<FaCalendarAlt />}
                onClick={() => setShowMeetingTime(true)}
                px={6}
                py={4}
              >
                Időpont kiválasztása
              </Button>
            </Box>
          ) : (
            // Real meeting
            <>
              <Heading size="xl">{book.title}</Heading>
              <Text><strong>Dátum:</strong> {date}</Text>
              <Text><strong>Idő:</strong> {time.slice(0, 5)}</Text>
              <Text><strong>Helyszín:</strong> {location}</Text>

              {meeting.is_active && (
                // Upcoming meeting UI
                <>
                  {/* Calendar & Map */}
                  <Wrap spacing="3" pt="4" justify="center">
                    <WrapItem>
                      <Button
                        leftIcon={<FaCalendarAlt />}
                        as={Link}
                        href={gc.toString()}
                        isExternal
                        flex="1"
                        minW="140px"
                      >
                        Hozzáadás a naptáradhoz
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <Button
                        leftIcon={<FaMapMarkerAlt />}
                        as={Link}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        isExternal
                        flex="1"
                        minW="140px"
                      >
                        Mutasd a térképen
                      </Button>
                    </WrapItem>
                  </Wrap>

                  {/* RSVP + Avatars with overflow */}
                  <Wrap spacing="3" pt="4" align="center">
                    <WrapItem>
                      <Button
                        colorScheme={isAttending ? 'green' : 'gray'}
                        onClick={toggleAttend}
                        minW="120px"
                      >
                        {isAttending ? 'Mégsem jövök' : 'Jövök'}
                      </Button>
                    </WrapItem>

                    <WrapItem onClick={() => setShowAtt(true)}>
                      <Menu.Root>
                        <Menu.Trigger asChild>
                          <AvatarGroup size="sm" spacing="-3" cursor="pointer">
                            {items.map(u => (
                              <Avatar.Root key={u.id}>
                                <Avatar.Fallback name={u.display_name} />
                                <Avatar.Image src={u.profile_picture} />
                              </Avatar.Root>
                            ))}
                            {overflow.length > 0 && (
                              <Avatar.Root variant="outline">
                                <Avatar.Fallback>+{overflow.length}</Avatar.Fallback>
                              </Avatar.Root>
                            )}
                          </AvatarGroup>
                        </Menu.Trigger>
                      </Menu.Root>
                    </WrapItem>
                  </Wrap>
                </>
              )}

              {!meeting.is_active && (
                // Past meeting avatars with overflow
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <AvatarGroup spacing="-3" mt="4" cursor="pointer" onClick={() => setShowAtt(true)}>
                      {items.map(u => (
                        <Avatar.Root size="sm" key={u.id}>
                          <Avatar.Fallback name={u.display_name} />
                          <Avatar.Image src={u.profile_picture} />
                        </Avatar.Root>
                      ))}
                      {overflow.length > 0 && (
                        <Avatar.Root>
                          <Avatar.Fallback>+{overflow.length}</Avatar.Fallback>
                        </Avatar.Root>
                      )}
                    </AvatarGroup>
                  </Menu.Trigger>
                </Menu.Root>
              )}
            </>
          )}
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
              maxH="80vh"
              overflowY="auto"
              onClick={(e) => e.stopPropagation()}
            >
              <VStack align="start" spacing="4">
                <HStack justify="space-between" w="full">
                  <Heading size="sm">
                    Résztvevők ({attendees.length})
                  </Heading>
                  <Button size="sm" onClick={() => setShowAtt(false)}>
                    Bezárás
                  </Button>
                </HStack>
                <VStack align="stretch" spacing="3" pt="2">
                  {attendees.map((u) => (
                    <HStack key={u.id} spacing="3">
                      <Avatar.Root size="md">
                        <Avatar.Fallback name={u.display_name} />
                        <Avatar.Image src={u.profile_picture} />
                      </Avatar.Root>
                      <Text fontSize="md">{u.display_name}</Text>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Box>
          </Box>,
          document.body
        )}
    </VStack>
  )
}
