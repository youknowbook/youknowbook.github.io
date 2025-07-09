import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Members from './pages/Members'
import Books from './pages/Books'
import Stats from './pages/Stats'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/members" element={<Members />} />
        <Route path="/books" element={<Books />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </Router>
  )
}

export default App
