// src/components/Login.jsx
import React, { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../api/supabaseClient'
import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  Link,
  Image,
} from '@chakra-ui/react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleForgotPassword = async () => {
    setError(''); setSuccess('')
    if (!email) {
      setError('Kérlek add meg az email-címed, hogy új jelszót kérhess.')
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setSuccess('✅ Nézd meg az emaileidet! Link elküldve.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    try {
      const { error: loginError } = await login(email, password)
      if (loginError) throw loginError

      const { data: authData, error: userError } = await supabase.auth.getUser()
      const user = authData?.user
      if (userError || !user) {
        setError('Nem tudtuk betölteni a felhasználói adatokat. Próbáld újra.')
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        const displayName = localStorage.getItem('pendingDisplayName') || ''
        await supabase.from('users').insert({
          id: user.id,
          display_name: displayName,
          motto: '',
          profile_picture: null,
          favourite_books: []
        })
        localStorage.removeItem('pendingDisplayName')
      }

      setSuccess('Bejelentkeztél! Átirányítunk…')
      setTimeout(() => navigate('/profile'), 800)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Bejelentkezési hiba. Kérlek, próbáld újra.')
    }
  }

  return (
    <Flex
      overflow="hidden"
      minH="100vh"
      align="center"
      justify="center"
      bg="linear(to-br, gray.50, blue.50)"
      position="relative"
      _before={{
        content: `""`,
        display: { base: 'none', md: 'block' },
        bgImage: `url(/black_circle_transparent.png)`,
        bgSize: 'cover',
        bgPos: 'center',
        opacity: 0.1,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Mobile‐only full-screen stacked logos */}
      <Box
        display={{ base: 'flex', md: 'none' }}
        position="absolute"
        top="0"
        left="0"
        w="100vw"
        h="100vh"
        flexDir="column"
        justify="space-between"
        align="center"
        zIndex={0}
        pointerEvents="none"
      >
        {[0.3, 0.6, 0.9].map((opacity, i) => (
          <Image
            key={i}
            src="/black_circle_transparent.png"
            boxSize="100vw"
            objectFit="cover"
            opacity={opacity}
          />
        ))}
      </Box>

      <Box
        bg="white"
        p={8}
        rounded="2xl"
        shadow="lg"
        w={{ base: '90%', md: '400px' }}
        zIndex={1}
      >
        <Heading mb={6} textAlign="center" color="gray.800">
          you-know-book
        </Heading>

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
              focusBorderColor="blue.400"
            />
            <Input
              placeholder="Jelszó"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              focusBorderColor="blue.400"
            />
            <Button type="submit" colorScheme="blue" width="full" size="lg">
              Bejelentkezés
            </Button>
            <Link
              onClick={handleForgotPassword}
              fontSize="sm"
              alignSelf="flex-end"
              color="blue.500"
            >
              Elfelejtett jelszó?
            </Link>
          </VStack>
        </form>

        <Text mt={6} textAlign="center" fontSize="sm">
          Még nincs fiókod?{' '}
          <Link as={RouterLink} to="/register" color="blue.600" fontWeight="bold">
            Regisztrálj itt
          </Link>
        </Text>
      </Box>
    </Flex>
  )
}
