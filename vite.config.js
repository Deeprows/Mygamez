import { defineConfig } from 'vite';

// base './' makes the build work on GitHub Pages under /<repo>/ with no changes.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
