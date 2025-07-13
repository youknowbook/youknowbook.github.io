import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Button,
  Stack,
  Image
} from '@chakra-ui/react'
import { useState } from 'react'
import { FaBars, FaTimes } from 'react-icons/fa'

const navItems = [
  { label: 'Főoldal', path: '/' },
  { label: 'Profilom', path: '/profile' },
  { label: 'Tagok', path: '/members' },
  { label: 'Könyvsarok', path: '/books' },
  { label: 'Statisztikák', path: '/stats' },
]

export default function PrivateRoute() {
  const { user, userData, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/login" replace />

  const handleNav = (path) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <>
      <Box bg="gray.100" px={4} mb={4} boxShadow="md">
        <Flex h={16} alignItems="center" justifyContent="space-between">
          <Box fontWeight="bold" display="flex" alignItems="center">
            <Image
              src={userData?.is_admin ? 'public/orange_rectangle_transparent.png' : 'public/black_rectangle_transparent.png'}
              alt="YKB Logo"
              h="16"
              ml="4"
              mr="4"
              objectFit="contain"
              onClick={() => handleNav('/')}
            />
          </Box>

          {/* Desktop */}
          <HStack
            as="nav"
            spacing={{ base: 1, md: 4 }}
            display={{ base: 'none', md: 'flex' }}
          >
            {navItems.map(({ label, path }) => (
              <Button
                key={path}
                size={{ base: 'sm', lg: 'md' }}
                fontSize={{ base: 'sm', lg: 'md' }}
                px={{ base: 2, lg: 4 }}
                variant={location.pathname === path ? 'solid' : 'ghost'}
                colorScheme="blue"
                onClick={() => handleNav(path)}
              >
                {label}
              </Button>
            ))}

            {userData?.is_admin && (
              <Button
                size={{ base: 'sm', lg: 'md' }}
                fontSize={{ base: 'sm', lg: 'md' }}
                px={{ base: 2, lg: 4 }}
                variant={location.pathname === '/admin' ? 'solid' : 'ghost'}
                colorScheme="purple"
                onClick={() => handleNav('/admin')}
              >
                Admin
              </Button>
            )}

            <Button
              size={{ base: 'sm', lg: 'md' }}
              fontSize={{ base: 'sm', lg: 'md' }}
              px={{ base: 2, lg: 4 }}
              colorScheme="red"
              onClick={logout}
            >
              Kijelentkezés
            </Button>
          </HStack>

          {/* Mobile Toggle */}
          <IconButton
            aria-label="Menü kinyit/becsuk"
            display={{ base: 'inline-flex', md: 'none' }}
            onClick={() => setMenuOpen(!menuOpen)}
            variant="ghost"
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </IconButton>
        </Flex>

        {/* Mobile Menu */}
        {menuOpen && (
          <Box pb={4} display={{ md: 'none' }}>
            <Stack as="nav" spacing={2}>
              {navItems.map(({ label, path }) => (
                <Button
                  key={path}
                  variant={location.pathname === path ? 'solid' : 'ghost'}
                  colorScheme="blue"
                  onClick={() => handleNav(path)}
                >
                  {label}
                </Button>
              ))}

              {userData?.is_admin && (
                <Button
                  variant={location.pathname === '/admin' ? 'solid' : 'ghost'}
                  colorScheme="purple"
                  onClick={() => handleNav('/admin')}
                >
                  Admin
                </Button>
              )}

              <Button size="sm" colorScheme="red" onClick={logout}>
                Kijelentkezés
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      <Outlet />
    </>
  )
}
