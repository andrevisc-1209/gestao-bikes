import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicBikePage from './pages/PublicBikePage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

// AdminPage lands in Task 7; this is a placeholder for the routing shell.
function AdminPage() {
  return <div>Admin page placeholder</div>
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/b/:tagNumber" element={<PublicBikePage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
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
