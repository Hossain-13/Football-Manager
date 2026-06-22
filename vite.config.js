import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TURF — Vite config. Plain SPA; Supabase handles all backend concerns.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true }, // host:true so you can open it on your phone over LAN
  build: { outDir: 'dist' },
});
