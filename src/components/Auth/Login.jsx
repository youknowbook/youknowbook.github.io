import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box,
  Button,
  Input,
  VStack,
  Heading,
  Text
} from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'
import { Link } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const base = import.meta.env.BASE_URL

  // — New: send reset email with proper redirect
  const handleForgotPassword = async () => {
    setError('')
    setSuccess('')

    if (!email) {
      setError('Kérlek add meg az email-címed, hogy új jelszót kérhess.')
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
       redirectTo: `${window.location.origin}${base}reset-password`
    })

    if (resetError) {
      console.error(resetError)
      setError(resetError.message)
    } else {
      setSuccess('✅ Nézd meg az emaljeidet, elküldtük a jelszó-visszaállító linket!')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data: loginData, error: loginError } = await login(email, password)
      if (loginError) throw loginError

      // ensure user profile exists…
      const { data: authUserData, error: userError } = await supabase.auth.getUser()
      const user = authUserData?.user
      if (userError || !user) {
        setError('Nem tudtuk betölteni a felhasználói adatokat. Kérlek, jelentkezz be újra.')
        return
      }
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profileData && !profileError) {
        const displayName = localStorage.getItem('pendingDisplayName') || ''
        const { error: insertError } = await supabase.from('users').insert({
          id: user.id,
          display_name: displayName,
          motto: '',
          profile_picture: null,
          favourite_books: []
        })
        localStorage.removeItem('pendingDisplayName')
        if (insertError) throw insertError
      }

      setSuccess('Bejelentkeztél! Átirányítunk...')
      setTimeout(() => navigate('/profile'), 800)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Bejelentkezési hiba. Kérlek, próbáld újra.')
    }
  }

  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Log In</Heading>

      {error && (
        <Box bg="red.100" borderRadius="md" p={3} mb={4}>
          <Text color="red.800" fontWeight="medium">⚠️ {error}</Text>
        </Box>
      )}

      {success && (
        <Box bg="green.100" borderRadius="md" p={3} mb={4}>
          <Text color="green.800" fontWeight="medium">{success}</Text>
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" colorScheme="blue" width="full">
            Bejelentkezés
          </Button>

          <Text mt="2" textAlign="right">
            <Link onClick={handleForgotPassword} cursor="pointer" fontSize="sm">
              Elfelejtett jelszó?
            </Link>
          </Text>
        </VStack>
      </form>

      <Text mt="4">
        Nincs felhasnzálód?{' '}
        <Link as={RouterLink} to="/register" color="blue.500">
          Regisztrálj!
        </Link>
      </Text>
    </Box>
  )
}
