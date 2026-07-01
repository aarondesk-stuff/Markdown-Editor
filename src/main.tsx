import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply theme and font size before first render to avoid flash of wrong values
;(function () {
  const stored = localStorage.getItem('markdown-darkmode')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = stored !== null ? stored === 'true' : prefersDark
  if (isDark) document.documentElement.dataset.theme = 'dark'

  const storedSize = localStorage.getItem('markdown-fontsize')
  if (storedSize) document.documentElement.style.setProperty('--content-size', `${storedSize}px`)
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error: unknown) => {
      console.warn('Service worker registration failed.', error)
    })
  })
}
