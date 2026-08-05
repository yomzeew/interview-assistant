import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-fix-paths',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        mkdirSync(dist, { recursive: true });

        // Copy manifest
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));

        // Fix absolute paths → relative paths in HTML files Vite emits
        const htmlFiles = ['sidepanel.html', 'offscreen.html'];
        for (const file of htmlFiles) {
          const htmlPath = resolve(dist, file);
          try {
            const content = readFileSync(htmlPath, 'utf-8');
            // Replace all src="/... and href="/... with src="./... and href="./...
            const fixed = content
              .replace(/\bsrc="\/(?!\/)/g, 'src="./')
              .replace(/\bhref="\/(?!\/)/g, 'href="./');
            writeFileSync(htmlPath, fixed, 'utf-8');
          } catch {
            // File may not exist on first run — ignore
          }
        }
      },
    },
  ],
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // HTML files at extension root → Vite outputs them as dist/sidepanel.html etc.
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        offscreen: resolve(__dirname, 'offscreen.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
          return 'js/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
