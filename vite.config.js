import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative paths so the build works from a subfolder, e.g. GitHub Pages at /ExpoPreview/.
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2500 },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei'],
    exclude: ['pdfjs-dist'],
  },
})
