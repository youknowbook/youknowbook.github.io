import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../api/supabaseClient'

const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null) // Supabase auth user
  const [userData, setUserData] = useState(null) // DB user row (with is_admin, etc.)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const authUser = session?.user ?? null
      setUser(authUser)
      setLoading(false)

      if (authUser) {
        fetchUserData(authUser.id)
      }
    }

    const fetchUserData = async (id) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()

      if (!error) {
        setUserData(data)
      } else {
        console.error('Failed to load userData:', error.message)
        setUserData(null)
      }
    }

    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        fetchUserData(authUser.id)
      } else {
        setUserData(null)
      }
    })

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  const login = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const register = (email, password) => supabase.auth.signUp({ email, password })
  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, userData, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
