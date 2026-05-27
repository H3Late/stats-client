// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/',
  plugins: [
    react({
      // Additional React plugin options if needed
      jsxRuntime: 'automatic',
    }),
    // Add development plugins if in dev environment (optional)
    ...(process.env.NODE_ENV !== "production" 
      ? [] // Add dev plugins here if needed later
      : []),
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@assets": path.resolve(__dirname, "src/assets"),
    },
  },
  build: {
    sourcemap: true,
    outDir: 'dist',
    emptyOutDir: true,
  },
  esbuild: {
    // Support for both .ts and .tsx files
    include: [
      'src/**/*.ts',
      'src/**/*.tsx'
    ],
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  }
});