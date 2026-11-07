import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './index.css';
import App from './App';
import { loadTileConfig } from './utils/tileLayer';

// Make Leaflet available globally
window.L = L;

// The Overpass client cached raw responses in localStorage (up to a few MB per area). It's gone
// since KAN-58; clear what returning players still hold. Safe to delete this block in Sprint 3.
try {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('overpass-response'))
    .forEach((key) => localStorage.removeItem(key));
} catch {
  // Storage can be blocked (private mode, site settings); nothing to clear then
}

// Tile source comes from the server at runtime; never rejects, so the app always renders
loadTileConfig().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
