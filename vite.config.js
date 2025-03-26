import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000
  },
  // Configura o diretório de saída para build
  build: {
    outDir: 'dist'
  }
})