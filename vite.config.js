import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public/assets',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'public/index.html',
    },
  },
  server: {
    open: '/public/index.html',
  },
});
