// src/components/Auth/ResetPassword.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../api/supabaseClient'
import {
  Box,
  Input,
  Button,
  VStack,
  Heading,
  Text
} from '@chakra-ui/react'

export default function ResetPassword() {
  const [ready, setReady] = useState(false)        // whether we have a valid recovery session
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // Once createClient({ detectSessionInUrl: true }) runs,
    // Supabase parses any recovery token from the URL into session storage.
    // Now we just fetch that session:
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setError('Leját vagy érvénytelen link.')
      } else {
        setReady(true)
      }
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!password || password !== confirmPassword) {
      setError('A jelszavaknak egyezniük kell és nem lehetnek üresek.')
      return
    }

    // This will use the recovery session that was just established
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('A jelszó sikeresen megváltozott! Most már bejelentkezhetsz.')
      setTimeout(() => navigate('/login'), 2000)
    }
  }

  // If we haven’t verified the session yet, show a spinner or message
  if (!ready) {
    return (
      <Box maxW="md" mx="auto" mt="10" textAlign="center">
        {error
          ? <Text color="red.500">{error}</Text>
          : <Text>Ellenőrízzük a link hitelességét...</Text>}
      </Box>
    )
  }

  // Otherwise, show the reset form
  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Jelszó visszaállítás </Heading>

      {error && <Text color="red.500" mb="4">{error}</Text>}
      {success && <Text color="green.500" mb="4">{success}</Text>}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input
            placeholder="Új jelszó"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            placeholder="Új jelszó újra"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" colorScheme="blue" width="full">
            Jelszó visszaállítás
          </Button>
        </VStack>
      </form>
    </Box>
  )
}
