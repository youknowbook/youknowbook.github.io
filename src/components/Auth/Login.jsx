import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box, Button, Input, VStack, Heading, Text, useToast
} from '@chakra-ui/react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast({ title: 'Logged in!', status: 'success' })
      navigate('/')
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error' })
    }
  }

  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb="6">Login</Heading>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" colorScheme="blue" width="full">Login</Button>
        </VStack>
      </form>
      <Text mt="4">Don't have an account? <a href="/register">Sign up</a></Text>
    </Box>
  )
}
