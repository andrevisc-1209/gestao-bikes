import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// TODO(Task 5): wrap <App /> with AuthContext provider once it exists.
// TODO(Task 6): wrap <App /> with ToastProvider once it exists.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
