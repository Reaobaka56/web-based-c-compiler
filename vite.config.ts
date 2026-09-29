import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  server: {
    proxy: {
      '/api/compile': {
        target: 'https://wandbox.org',
        changeOrigin: true,
        rewrite: () => '/api/compile.json'
      }
    },
    headers: {
      // Required if you later enable std::thread (SharedArrayBuffer)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
