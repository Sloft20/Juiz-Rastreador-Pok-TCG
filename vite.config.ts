import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Juiz/Rastreador PokéTCG/', // <--- ADICIONE ESTA LINHA (use o nome exato do seu repo)
})