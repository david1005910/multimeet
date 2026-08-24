import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NewMeeting from './pages/NewMeeting'
import MinutesMode from './pages/MinutesMode'
import MinutesViewer from './pages/MinutesViewer'
import InterpretMode from './pages/InterpretMode'
import MeetingList from './pages/MeetingList'
import Settings from './pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="meetings" element={<MeetingList />} />
        <Route path="meetings/new" element={<NewMeeting />} />
        <Route path="meetings/:meetingId/minutes" element={<MinutesMode />} />
        <Route path="meetings/:meetingId/minutes/view" element={<MinutesViewer />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route
        path="/meetings/:meetingId/interpret"
        element={
          <ProtectedRoute>
            <InterpretMode />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
