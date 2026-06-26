import { defineConfig } from 'vite';

// Vite configuration for the Last Man Standing POC.
// Three.js is large; we pre-bundle it and split it into its own chunk so the
// main game logic can be cached/iterated independently.
export default defineConfig({
  base: './',
  server: {
    host: true,
    open: true,
  },
  build: {
    target: 'es2021',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['three'],
  },
});
