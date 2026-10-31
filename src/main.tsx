import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { installZeroLocationPrivacyShield } from './engine/privacyShield';
import './index.css';

// Immediately lock down Geolocation API, Permissions probing & WebRTC IP leak vectors
// so player physical location is NEVER accessible to third parties, servers, or crackers
installZeroLocationPrivacyShield();

// Register Service Worker immediately so all 3D circuits, vehicles, and assets work offline
registerSW({
  immediate: true,
  onRegisterError: () => {
    // Safely ignore if service workers are restricted by browser privacy mode
  },
});

// Tier 1 Google Maps Platform Demo Key Quota & Auth Failure Defense
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  origConsoleError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
