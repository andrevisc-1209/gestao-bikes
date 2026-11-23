import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicBikePage from './pages/PublicBikePage'

// Remaining pages land in later tasks; these are placeholders for the routing shell.
function CadastroPage() {
  return <div>Cadastro page placeholder</div>
}

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
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/cadastro" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
