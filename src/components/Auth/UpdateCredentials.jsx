// src/components/Auth/UpdateCredentials.jsx
import React, { useState } from 'react'
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
  Image
} from '@chakra-ui/react'

export default function UpdateCredentials() {
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')

    const { data, error: updErr } = await supabase.auth.updateUser(
        { email: newEmail, password: newPassword },
        { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}profile` }
    )
    if (updErr) {
        setError(updErr.message)
        return
    }

    localStorage.setItem('justUpdated', 'true')
    setSuccess('✅ Sikeresen frissítve! Mindjárt kapsz egy emailt, amiben megerősítheted a változtatásokat.')
    setTimeout(() => {
        supabase.auth.signOut()
        navigate('/login')
    }, 1500)
    }

  return (
    <Flex
      overflow="hidden"
      minH="100vh"
      align="center"
      justify="center"
      bg="linear(to-br, gray.50, red.50)"
      position="relative"
      _before={{
        content: `""`,
        display: { base: 'none', md: 'block' },
        bgImage: `url(/red_circle_transparent.png)`,
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
            src="/red_circle_transparent.png"
            boxSize="100vw"
            objectFit="cover"
            opacity={opacity}
          />
        ))}
      </Box>
      <Box bg="white" p={8} rounded="2xl" shadow="lg" w={{ base: '90%', md: '400px' }} zIndex={1}>
        <Heading mb={6} textAlign="center">
          Frissítsd az e-mail címed és jelszavad
        </Heading>
        {error && (
          <Text color="red.500" mb={4}>
            {error}
          </Text>
        )}
        {success && (
          <Text color="green.500" mb={4}>
            {success}
          </Text>
        )}

        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            <Input
              placeholder="Új e-mail cím"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              focusBorderColor="blue.400"
            />
            <Input
              placeholder="Új jelszó"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              focusBorderColor="blue.400"
            />
            <Button type="submit" colorScheme="blue" width="full">
              Frissítés és kijelentkezés
            </Button>
          </VStack>
        </form>
      </Box>
    </Flex>
  )
}
