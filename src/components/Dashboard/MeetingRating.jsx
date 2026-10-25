import { useEffect, useState } from 'react'
import { Box, HStack, Text } from '@chakra-ui/react'
import { FaStar } from 'react-icons/fa'
import { supabase } from '../../api/supabaseClient'

export default function MeetingRating({ meetingId, attendees }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    let requestId = 0
    setSummary(null)
    setError(false)
    const refresh = async () => {
      const currentRequest = ++requestId
      const { data, error } = await supabase.rpc('get_meeting_rating', { p_meeting_id: String(meetingId) })
      if (cancelled || currentRequest !== requestId) return
      setError(!!error)
      setSummary(error ? null : data?.[0] || null)
    }
    refresh()
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 30000)
    const onVisible = () => { if (!document.hidden) refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [meetingId, attendees])

  if (error) return <Text role="status" fontSize="sm">Az értékelések átlaga most nem tölthető be.</Text>
  if (!summary) return <Text fontSize="sm">Értékelések betöltése…</Text>
  if (!Number(summary.rating_count)) return <Text fontSize="sm">Még nincs résztvevői értékelés.</Text>
  const stars = Number(summary.average_rating) / 2
  return (
    <Box w="full" textAlign="center" py={4}>
      <HStack gap={2} justify="center" role="img" aria-label={`Résztvevők értékelése: ${stars.toFixed(2)} az 5-ből`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Box key={i} position="relative" color="gray.300" fontSize={{ base: '32px', md: '40px' }} aria-hidden="true">
            <FaStar />
            <Box position="absolute" inset={0} width={`${Math.max(0, Math.min(1, stars - i)) * 100}%`}
              overflow="hidden" color="yellow.500"><FaStar /></Box>
          </Box>
        ))}
      </HStack>
      <Text fontSize="lg" fontWeight="medium" mt={2}>{stars.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} / 5 · {summary.rating_count} értékelés</Text>
    </Box>
  )
}
