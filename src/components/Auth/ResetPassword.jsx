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
        setError('Invalid or expired reset link.')
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
      setError('Passwords must match and not be empty.')
      return
    }

    // This will use the recovery session that was just established
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Password updated! Redirecting to login…')
      setTimeout(() => navigate('/login'), 2000)
    }
  }

  // If we haven’t verified the session yet, show a spinner or message
  if (!ready) {
    return (
      <Box maxW="md" mx="auto" mt="10" textAlign="center">
        {error
          ? <Text color="red.500">{error}</Text>
          : <Text>Verifying reset link…</Text>}
      </Box>
    )
  }

  // Otherwise, show the reset form
  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Reset Password</Heading>

      {error && <Text color="red.500" mb="4">{error}</Text>}
      {success && <Text color="green.500" mb="4">{success}</Text>}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input
            placeholder="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" colorScheme="blue" width="full">
            Reset Password
          </Button>
        </VStack>
      </form>
    </Box>
  )
}
