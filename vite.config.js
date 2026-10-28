
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Quiz Arena',
        short_name: 'Quiz Arena',
        description: 'Create quizzes and play with friends',
        theme_color: '#111827',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/',
      },
    }),
  ],
})
