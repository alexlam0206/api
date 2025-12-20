import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/v1": "http://127.0.0.1:8787",
    },
  },
  build: {
    minify: false, // Disable minification to make debugging easier
    sourcemap: true, // Enable sourcemaps for debugging
  },
})
