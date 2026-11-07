import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './index.css';
import App from './App';
import { loadTileConfig } from './utils/tileLayer';

// Make Leaflet available globally
window.L = L;

// Tile source comes from the server at runtime; never rejects, so the app always renders
loadTileConfig().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
