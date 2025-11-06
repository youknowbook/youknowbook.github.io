import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AuthProvider } from './context/AuthContext'

console.log("HAS PASSCODE:", Boolean(import.meta.env.VITE_SECRET_PASSCODE));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ChakraProvider>
  </React.StrictMode>
)
