import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const rawCarto = env.VITE_CARTO_API_KEY || process.env.VITE_CARTO_API_KEY || '';
  const cartoKey = (rawCarto && !rawCarto.includes('YOUR_KEY') && !rawCarto.includes('http') && rawCarto.length > 5)
    ? rawCarto.trim()
    : 'cb1_3tnb_1_2da65b7a79e52dc561858c69';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'import.meta.env.VITE_CARTO_API_KEY': JSON.stringify(cartoKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
