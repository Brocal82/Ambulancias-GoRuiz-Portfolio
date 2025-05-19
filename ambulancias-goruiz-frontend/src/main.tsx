import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <h1 className="text-8xl text-blue-500 bg-yellow-200 p-4 rounded">Goruiz</h1>
  </StrictMode>,
)
