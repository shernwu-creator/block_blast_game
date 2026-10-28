import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/orbitron'
import '@fontsource-variable/space-grotesk'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: the service worker is only needed for the built site (offline play and
// desktop installation), so skip it during `pnpm dev`.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch((error) => {
        console.warn('[PWA] Service worker registration failed:', error)
      })
  })
}

