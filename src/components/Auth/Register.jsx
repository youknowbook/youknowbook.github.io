import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box, Button, Input, VStack, Heading, Text, useToast
} from '@chakra-ui/react'
import { supabase } from '../../api/supabaseClient'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const { user } = await register(email, password)

      // Auto-insert empty profile row
      const currentUser = (await supabase.auth.getUser()).data.user
      await supabase.from('users').insert({
        id: currentUser.id,
        motto: '',
        profile_picture: null,
        favourite_books: []
      })

      toast({ title: 'Registered!', status: 'success' })
      navigate('/profile')
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error' })
    }
  }

  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Register</Heading>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" colorScheme="blue" width="full">Sign Up</Button>
        </VStack>
      </form>
      <Text mt="4">Already have an account? <a href="/login">Log in</a></Text>
    </Box>
  )
}
