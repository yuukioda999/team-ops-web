import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans-jp/400.css'
import '@fontsource/ibm-plex-sans-jp/700.css'
import '@fontsource/barlow-condensed/700.css'
import './index.css'
import './components/ui.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
