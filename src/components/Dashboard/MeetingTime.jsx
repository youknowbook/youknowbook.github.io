import React, { useState, useMemo, useEffect } from 'react'
import {
  Box,
  Grid,
  Text,
  VStack,
  AvatarGroup,
  HStack,
  AspectRatio,
} from '@chakra-ui/react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@chakra-ui/react'
import { format, getDaysInMonth, startOfMonth } from 'date-fns'
import { supabase } from '../../api/supabaseClient'
import { useAuth } from '../../context/AuthContext'

const fullWeekdays = ['Hétfő','Kedd','Szerda','Csütörtök','Péntek','Szombat','Vasárnap']
const initials     = fullWeekdays.map(d => d[0])

export default function MeetingTime({
  roundId,
  initialParticipants = {},
  onChange = () => {},
  readOnly = false,
}) {
  const { user } = useAuth()
  const userId    = user.id
  const avatarUrl = user.user_metadata?.avatar_url || ''

  const [isDark, setIsDark] = useState(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mql      = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = e => setIsDark(e.matches)
    mql.addEventListener?.('change', listener) ?? mql.addListener(listener)
    return () => {
      mql.removeEventListener?.('change', listener)
      mql.removeListener(listener)
    }
  }, [])
  const cellBg  = isDark ? 'gray.700' : 'gray.50'
  const hoverBg = isDark ? 'blue.600' : 'blue.100'

  // ← right after props destructuring
  const [year, setYear] = useState(null)
  const [month, setMonth] = useState(null)

  useEffect(() => {
    if (!roundId) return
    supabase
      .from('date_selection_rounds')
      .select('year, month')
      .eq('id', roundId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Failed to load round date:', error)
        else {
          setYear(data.year)
          setMonth(Number(data.month))
        }
      })
  }, [roundId])

  const [participantsByDate, setParticipantsByDate] =
    useState(initialParticipants)

  async function fetchParticipants() {
    if (!roundId) return
    const { data, error } = await supabase
      .from('date_selection_choices')
      .select('selected_date, user_id, users(profile_picture,display_name)')
      .eq('round_id', roundId)

    if (error) {
      alert('Hiba betöltéskor: ' + error.message)
      return
    }

    const map = {}
    data.forEach(({ selected_date, user_id, users }) => {
      const d = typeof selected_date === 'string'
        ? selected_date.slice(0,10)
        : new Date(selected_date).toISOString().slice(0,10)
      map[d] = map[d] || []
      map[d].push({
        url:    users.profile_picture,
        name:   users.display_name,
        userId: user_id,
      })
    })
    setParticipantsByDate(map)
  }

  useEffect(() => {
    fetchParticipants()
  }, [roundId])

  const calendarCells = useMemo(() => {
    const idx    = month - 1
    const fm     = startOfMonth(new Date(year, idx))
    const total  = getDaysInMonth(fm)
    const blanks = (fm.getDay() + 6) % 7
    const cells  = Array.from(
      { length: blanks + total },
      (_, i) => (i < blanks ? null : i - blanks + 1)
    )
    while (cells.length % 7) cells.push(null)
    return cells
  }, [year, month])

  if (year === null || month === null) {
    return <Text>Betöltés…</Text>
  }

  async function handleDayClick(day) {
    if (readOnly || !roundId) return
    const key     = format(new Date(year, month-1, day), 'yyyy-MM-dd')
    const avatars = participantsByDate[key] || []
    const entry   = avatars.find(a => a.userId === user.id)

    if (!entry) {
      const { error } = await supabase
        .from('date_selection_choices')
        .insert({ round_id: roundId, user_id: user.id, selected_date: key })
      if (error) {
        alert('Hiba mentéskor: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('date_selection_choices')
        .delete()
        .eq('round_id', roundId)
        .eq('user_id',  user.id)
        .eq('selected_date', key)
      if (error) {
        alert('Hiba törléskor: ' + error.message)
        return
      }
    }

    await fetchParticipants()
  }

  // compute top-5 dates by number of participants
  const topFive = Object.entries(participantsByDate)
    .sort(([,a],[,b]) => b.length - a.length)
    .slice(0,5)

  return (
    <VStack spacing={6} align="stretch">
      {/* Weekday headers */}
      <Grid templateColumns="repeat(7,1fr)" textAlign="center" gap={2}>
        {fullWeekdays.map((full, i) => (
          <Box key={i} fontWeight="bold">
            <Text display={{ base: 'none', md: 'block' }}>{full}</Text>
            <Text display={{ base: 'block', md: 'none' }}>
              {initials[i]}
            </Text>
          </Box>
        ))}
      </Grid>

      {/* Calendar grid */}
      <Grid templateColumns="repeat(7,1fr)" gap={2}>
        {calendarCells.map((day, i) => {
          const key     = day
            ? format(new Date(year, month-1, day), 'yyyy-MM-dd')
            : null
          const avatars = key ? participantsByDate[key] || [] : []
          const isMe    = avatars.some(a => a.userId === user.id)

          return (
            <AspectRatio ratio={1} key={i} w="100%">
              <Box
                bg={day ? (isMe ? 'green.200' : cellBg) : 'transparent'}
                borderRadius="md"
                p={2}
                cursor={day && !readOnly ? 'pointer' : 'default'}
                _hover={day && !readOnly ? { bg: hoverBg } : {}}
                onClick={() => day && handleDayClick(day)}
                display="flex"
                flexDir="column"
                justifyContent="flex-start"
                alignItems="flex-start"
                overflow="hidden"
                position="relative"
              >
                {day && <Text fontSize="sm" mb={2}>{day}</Text>}

                {avatars.length > 0 && (
                  <AvatarGroup
                    size="xs"
                    stacking="first-on-top"
                    display={{ base: 'none', md: 'flex' }}
                    spacing="-1"
                    position="absolute"
                    bottom="2"
                    left="2"
                  >
                    {avatars.slice(0, 4).map((a) => (
                      <Avatar.Root key={a.userId}>
                        <Avatar.Fallback>{a.name[0]}</Avatar.Fallback>
                        <Avatar.Image src={a.url} alt={a.name} />
                      </Avatar.Root>
                    ))}
                    {avatars.length > 5 && (
                      <Avatar.Root>
                        <Avatar.Fallback>+{avatars.length - 4}</Avatar.Fallback>
                      </Avatar.Root>
                    )}
                  </AvatarGroup>
                )}
              </Box>
            </AspectRatio>
          )
        })}
      </Grid>

      {/* mobile-only top-5 list */}
      <Box display={{ base: 'block', md: 'none' }}>
        <Text fontWeight="bold" mb={2} textAlign="center">
          Legnépszerűbb napok
        </Text>
        <VStack spacing={4} align="stretch">
          {topFive.map(([date, avatars]) => (
            <HStack key={date} p={2} border="1px solid" borderRadius="md">
              <Box flex="0 0 60px">
                <Text fontWeight="bold">{date.slice(8)}</Text>
                <Text fontSize="xs" color="gray.500">
                  {date.slice(5,7)}.{date.slice(8)}
                </Text>
              </Box>
              <AvatarGroup
                size="sm"
                stacking="first-on-top"
                display={{ base: 'flex', md: 'none' }}
              >
                {avatars.slice(0, 4).map((a) => (
                  <Avatar.Root key={a.userId}>
                    <Avatar.Fallback>{a.name[0]}</Avatar.Fallback>
                    <Avatar.Image src={a.url} alt={a.name} />
                  </Avatar.Root>
                ))}
                {avatars.length > 5 && (
                  <Avatar.Root>
                    <Avatar.Fallback>+{avatars.length - 4}</Avatar.Fallback>
                  </Avatar.Root>
                )}
              </AvatarGroup>
            </HStack>
          ))}
        </VStack>
      </Box>
    </VStack>
  )
}
