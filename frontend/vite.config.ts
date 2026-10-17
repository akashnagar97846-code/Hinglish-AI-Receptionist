import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const bot = 'http://localhost:7860';
const api = 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/start': bot, '/sessions': bot, '/status': bot, '/api': api },
  },
});