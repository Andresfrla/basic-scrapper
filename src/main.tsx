import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Agregar handler para errores globales
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error("%c❌ ERROR GLOBAL:", "color: red; font-weight: bold; font-size: 16px", {
    msg, url, lineNo, columnNo, error
  });
  return false;
};

window.onunhandledrejection = function(event) {
  console.error("%c❌ PROMESA RECHAZADA:", "color: red; font-weight: bold; font-size: 16px", event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
