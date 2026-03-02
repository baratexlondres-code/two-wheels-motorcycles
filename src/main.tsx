import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force service worker update and clear old caches on every load
if ('serviceWorker' in navigator) {
  // Clear all old caches to force fresh content
  if ('caches' in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        // Keep only the latest workbox caches
        if (!name.includes('workbox-precache')) {
          caches.delete(name);
        }
      });
    });
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });

  // Listen for new service worker and reload
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
