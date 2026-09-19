import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'

async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== '1') {
    return
  }

  const { worker } = await import('./mocks/browser.js')

  return worker.start({
    onUnhandledRequest: 'bypass',
  })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})