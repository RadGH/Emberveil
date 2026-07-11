import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'node:fs';

const KEYS_DIR = resolve(__dirname, '../assets/references/emberveil');
function readKey(filename) {
  try {
    return fs.readFileSync(resolve(KEYS_DIR, filename), 'utf8').trim();
  } catch {
    return '';
  }
}
const SUPABASE_URL = readKey('supabase-url.txt');
const SUPABASE_PUBLISHABLE_KEY = readKey('supabase-publishable-key.txt');

export default defineConfig({
  base: process.env.VITE_BASE || './',
  server: {
    port: 5213,
    host: true
  },
  define: {
    __SUPABASE_URL__: JSON.stringify(SUPABASE_URL),
    __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
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
