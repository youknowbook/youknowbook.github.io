import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  Button,
  Stack,
} from '@chakra-ui/react'
import { useState } from 'react'
import { FaBars, FaTimes } from 'react-icons/fa'

const navItems = [
  { label: 'Dashboard', path: '/' },
  { label: 'Profile', path: '/profile' },
  { label: 'Members', path: '/members' },
  { label: 'Books', path: '/books' },
  { label: 'Stats', path: '/stats' },
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
          <Box fontWeight="bold">{userData?.is_admin ? "📚 Book Club (Admin)" : "📚 Book Club"}</Box>

          {/* Desktop */}
          <HStack as="nav" spacing={4} display={{ base: 'none', md: 'flex' }}>
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
              Log out
            </Button>
          </HStack>

          {/* Mobile Toggle */}
          <IconButton
            aria-label="Toggle Menu"
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
                Log out
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      <Outlet />
    </>
  )
}
