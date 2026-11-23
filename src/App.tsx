import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicBikePage from './pages/PublicBikePage'
import RegisterPage from './pages/RegisterPage'

// Remaining pages land in later tasks; these are placeholders for the routing shell.
function LoginPage() {
  return <div>Login page placeholder</div>
}

function AdminPage() {
  return <div>Admin page placeholder</div>
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/b/:tagNumber" element={<PublicBikePage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/cadastro" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
