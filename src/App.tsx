import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Login from './pages/Login'
import DoctorLayout from './components/DoctorLayout'
import PatientLayout from './components/PatientLayout'
import AssistantLayout from './components/AssistantLayout'
import Dashboard from './pages/Dashboard'
import WritePrescription from './pages/WritePrescription'
import PrintPrescription from './pages/PrintPrescription'
import AdminMigration from './pages/AdminMigration'
import Settings from './pages/Settings'
import PatientDashboard from './pages/patient/PatientDashboard'
import AssistantDashboard from './pages/assistant/AssistantDashboard'
import DoctorVideoDashboard from './pages/doctor/DoctorVideoDashboard'
import DoctorReports from './pages/doctor/DoctorReports'
import VideoCall from './pages/VideoCall'
import History from './pages/History'
import DoctorProfile from './pages/doctor/DoctorProfile'
import ManageAssistant from './pages/doctor/ManageAssistant'

const ProtectedRoute = ({ allowedRole }: { allowedRole?: 'doctor' | 'assistant' | 'patient' }) => {
  const { user, role, loading } = useAuth()

  if (loading) return <div className="p-4">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  if (allowedRole && role !== allowedRole) {
    // Redirect to correct dashboard if trying to access wrong area
    if (role === 'doctor') return <Navigate to="/write" replace />
    if (role === 'patient') return <Navigate to="/patient/dashboard" replace />
    if (role === 'assistant') return <Navigate to="/assistant/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Assistant Routes */}
          <Route element={<ProtectedRoute allowedRole="assistant" />}>
            <Route element={<AssistantLayout />}>
              <Route path="/assistant/dashboard" element={<AssistantDashboard />} />
            </Route>
          </Route>


          {/* Patient Routes */}
          <Route element={<ProtectedRoute allowedRole="patient" />}>
            <Route element={<PatientLayout />}>
              <Route path="/patient/dashboard" element={<PatientDashboard />} />
              <Route path="/patient/video-call" element={<VideoCall />} />
            </Route>
          </Route>

          {/* Doctor Routes */}
          <Route element={<ProtectedRoute allowedRole="doctor" />}>
            <Route element={<DoctorLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/write" element={<WritePrescription />} />
              <Route path="/history" element={<History />} />
              <Route path="/print/:id" element={<PrintPrescription />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/migrate" element={<AdminMigration />} />
              <Route path="/video-call" element={<DoctorVideoDashboard />} />
              <Route path="/reports" element={<DoctorReports />} />
              <Route path="/profile" element={<DoctorProfile />} />
              <Route path="/manage-assistant" element={<ManageAssistant />} />
            </Route>
          </Route>

          {/* Shared Video Call Route (Protected) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/video-call/:appointmentId" element={<VideoCall />} />
          </Route>

        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
