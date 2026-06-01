import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SimuladorGases from './SimuladorGases.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SimuladorGases />
  </StrictMode>,
)
