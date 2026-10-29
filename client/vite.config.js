import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Send /api calls to the Express server, so the client can always use '/api'
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
});