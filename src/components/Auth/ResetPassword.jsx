// src/components/Auth/ResetPassword.jsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../api/supabaseClient'
import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  Image,
} from '@chakra-ui/react'

export default function ResetPassword() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) return setError('Lejárt vagy érvénytelen link.')
        setReady(true)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) setError('Lejárt vagy érvénytelen link.')
      else setReady(true)
    }

    run()
  }, [])


  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (!password || password !== confirmPassword) {
      setError('A jelszavaknak egyezniük kell és nem lehetnek üresek.')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('A jelszó sikeresen megváltozott! Átirányítás bejelentkezéshez…')
      setTimeout(() => navigate('/login'), 2000)
    }
  }

  if (!ready) {
    return (
      <Flex
        overflow="hidden"
        minH="100vh"
        align="center"
        justify="center"
        bg="linear(to-br, gray.50, blue.50)"
        position="relative"
      >
        <Box bg="white" p={6} rounded="2xl" shadow="lg" textAlign="center">
          {error
            ? <Text color="red.500">{error}</Text>
            : <Text>Ellenőrizzük a link hitelességét…</Text>}
        </Box>
      </Flex>
    )
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
        bgImage: `url(/orange_circle_transparent.png)`,
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
            src="/orange_circle_transparent.png"
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
          Jelszó visszaállítás
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
              placeholder="Új jelszó"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              focusBorderColor="blue.400"
            />
            <Input
              placeholder="Új jelszó újra"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              focusBorderColor="blue.400"
            />
            <Button type="submit" colorScheme="blue" width="full" size="lg">
              Jelszó visszaállítás
            </Button>
          </VStack>
        </form>
      </Box>
    </Flex>
  )
}
