import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AuthProvider } from './context/AuthContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ChakraProvider>
  </React.StrictMode>
)
