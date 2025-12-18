import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Login from './pages/Login'
import DoctorLayout from './components/DoctorLayout'
import Dashboard from './pages/Dashboard'
import WritePrescription from './pages/WritePrescription'
import PrintPrescription from './pages/PrintPrescription'
import AdminMigration from './pages/AdminMigration'
import Settings from './pages/Settings'

const ProtectedRoute = () => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            {/* Doctor Routes */}
            <Route element={<DoctorLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/write" element={<WritePrescription />} />
              <Route path="/history" element={<div className="p-4">History (Coming Soon)</div>} />
              <Route path="/print/:id" element={<PrintPrescription />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/migrate" element={<AdminMigration />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
