// src/components/Register.jsx
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

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    try {
      const { data, error: regError } = await register(email, password)
      if (regError) throw regError
      const user = data.user
      if (!user) {
        setSuccess('Erősítsd meg az e-mail címed, mielőtt belépnél!')
        return
      }
      localStorage.setItem('pendingDisplayName', displayName)
      navigate('/profile')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Regisztrációs hiba. Kérlek, próbáld újra.')
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
        bgImage: `url(blue_circle_transparent.png)`,
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
            src="/blue_circle_transparent.png"
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
              placeholder="Név"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              focusBorderColor="blue.400"
            />
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
              Regisztráció
            </Button>
          </VStack>
        </form>

        <Text mt={6} textAlign="center" fontSize="sm">
          Már van fiókod?{' '}
          <Link as={RouterLink} to="/login" color="blue.600" fontWeight="bold">
            Jelentkezz be!
          </Link>
        </Text>
      </Box>
    </Flex>
  )
}
