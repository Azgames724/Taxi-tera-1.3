import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  // Clear any older caches that might contain blank or watermarked tiles
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name !== 'taxi-tera-cache-v8') {
          caches.delete(name);
        }
      });
    });
  }

  // In local/dev preview mode, unregister any conflicting service worker to prevent preview freezing
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          reg.update();
          console.log('Service Worker registered:', reg.scope);
        })
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }
}
