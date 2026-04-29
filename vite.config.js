import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        contentScript: resolve(__dirname, 'src/extension/content-script.js'),
        background: resolve(__dirname, 'src/extension/background.js'),
        options: resolve(__dirname, 'src/options/options.js')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.js'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.js']
    }
  }
});
