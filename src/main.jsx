import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PredictionMarket from './PredictionMarket'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PredictionMarket />
  </StrictMode>
)