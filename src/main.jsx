import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AuthProvider } from './context/AuthContext'

console.log("STAGING URL:", import.meta.env.VITE_SUPABASE_URL)
console.log("STAGING KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY)


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ChakraProvider>
  </React.StrictMode>
)
