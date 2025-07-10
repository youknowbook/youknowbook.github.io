import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Members from './pages/Members'
import Books from './pages/Books'
import Stats from './pages/Stats'
import Admin from './pages/Admin'
import PrivateRoute from './components/Layout/PrivateRoute'
import AdminRoute from './components/Layout/AdminRoute'
import { useAuth } from './context/AuthContext'
import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react'
import ResetPassword from './components/Auth/ResetPassword'

const basename = import.meta.env.BASE_URL

function Home() {
  const { user } = useAuth()

  if (user) {
    // Redirect logged-in users to the protected dashboard route
    return <Navigate to="/" />
  }

  return (
    <Box maxW="md" mx="auto" mt="10">
      <Heading mb={4}>Welcome to the Book Club</Heading>
      <VStack spacing={4}>
        <Text>If you have an account, please log in. Otherwise, register:</Text>
        <Button as="a" href={`${basename}/login`} colorScheme="blue" width="full">
          Login
        </Button>
        <Button as="a" href={`${basename}/register`} variant="outline" width="full">
          Register
        </Button>
      </VStack>
    </Box>
  )
}

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Auth-dependent Home */}
        <Route path="/" element={<Home />} />

        {/* Protected Routes with Standard Navbar */}
        <Route element={<PrivateRoute />}>
          <Route index element={<Dashboard />} /> {/* Same as path="/" when logged in */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/members" element={<Members />} />
          <Route path="/books" element={<Books />} />
          <Route path="/stats" element={<Stats />} />
          {/* Admin-only Routes */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  )
}

export default App
