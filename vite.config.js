import { defineConfig } from 'vite';
import { resolve } from 'path';

// Accounts + cloud saves talk to our own game server (rgs-api). Its address is
// VITE_RGS_API (read in src/auth/supabaseClient.js), default '/api' on the same
// site — so the build no longer needs any key files.

export default defineConfig({
  base: process.env.VITE_BASE || './',
  server: {
    port: 5213,
    host: true
  },
  define: {
    // Deploy base for runtime asset loads (`${__APP_BASE__}images/...`).
    // We use our own global instead of import.meta.env.BASE_URL because Vite
    // bakes that to "/" here, which 404s all sprites/data on a subpath deploy
    // (GitHub Pages /Emberveil/). Src refs were migrated to __APP_BASE__.
    __APP_BASE__: JSON.stringify(process.env.VITE_BASE || '/'),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        play: resolve(__dirname, 'play.html'),
        marketing: resolve(__dirname, 'index.html'),
        contact: resolve(__dirname, 'contact.html'),
        authTest: resolve(__dirname, 'auth-test.html'),
      }
    }
  }
});
