import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const { data: loginData, error: loginError } = await login(email, password)

      if (loginError) throw loginError

      const { data: authUserData, error: userError } = await supabase.auth.getUser()
      const user = authUserData?.user
      if (userError || !user) {
        setError('Could not retrieve user data.')
        return
      }

      // Check if profile exists
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

        localStorage.removeItem('pendingDisplayName') // cleanup

        if (insertError) throw insertError
      }

      setSuccess('Logged in!')
      navigate('/profile')

    } catch (err) {
      console.error(err)
      setError(err.message || 'Login failed.')
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
          <Text color="green.800" fontWeight="medium">✅ {success}</Text>
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input
            placeholder="Email"
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
            Log In
          </Button>
        </VStack>
      </form>

      <Text mt="4">
        Don’t have an account?{' '}
        <Link to="/register" style={{ color: '#3182ce' }}>Register</Link>
      </Text>
    </Box>
  )
}
