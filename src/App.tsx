import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicBikePage from './pages/PublicBikePage'
import RegisterPage from './pages/RegisterPage'
import OccurrenceEntryPage from './pages/OccurrenceEntryPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/b/:tagNumber" element={<PublicBikePage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/ocorrencia" element={<OccurrenceEntryPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/cadastro" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}

export default App
