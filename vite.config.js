import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

function readIfExists(p) { try { return fs.readFileSync(p) } catch { return null } }

const key  = readIfExists(path.resolve('188.47.17.125+4-key.pem'))
const cert = readIfExists(path.resolve('188.47.17.125+4.pem'))

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    https: key && cert ? { key, cert } : false,
    // 🔑 Najprostsza działająca droga: reverse-proxy *tylko* hosta z obrazkami
    proxy: {
      // Każdy URL zaczynający się od /imgblix/ zostanie przekazany do https://img.blix.pl
      // więc w kodzie używamy /imgblix/api/... zamiast https://img.blix.pl/api/...
      '/imgblix': {
        target: 'https://img.blix.pl',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/imgblix/, ''),
      },
    },
  },
})
