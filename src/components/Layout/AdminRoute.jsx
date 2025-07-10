import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Box, Center, Spinner, Text } from '@chakra-ui/react'

export default function AdminRoute() {
  const { user, userData } = useAuth()

  if (userData === null && user !== null) {
    return (
      <Center mt={10}>
        <Spinner size="xl" />
      </Center>
    )
  }

  if (!user || !userData?.is_admin) {
    return (
      <Box textAlign="center" mt={10}>
        <Text fontSize="xl" color="red.500">
          ❌ You do not have permission to view this page.
        </Text>
        <Navigate to="/" replace />
      </Box>
    )
  }

  return <Outlet />
}
