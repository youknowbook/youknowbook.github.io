import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box, Button, Input, VStack, Heading, Text
} from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'
import { Link } from 'react-router-dom'


export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [displayName, setDisplayName] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { data, error } = await register(email, password)

      if (error) throw error

      const user = data.user

      if (!user) {
        alert('Please confirm your email before logging in.')
        return
      }
      
      localStorage.setItem('pendingDisplayName', displayName)
      navigate('/profile')
    } catch (err) {
      console.error(err)
      alert(err.message)
    }
  }


  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Register</Heading>

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
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
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
            Sign Up
          </Button>
        </VStack>
      </form>

      <Text mt="4">
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#3182ce' }}>Log in</Link>
      </Text>
    </Box>
  )
}
