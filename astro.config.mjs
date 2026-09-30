import { defineConfig, sessionDrivers, passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://dulichladakh.com',
  trailingSlash: 'never',
  output: 'server',
  session: {
    driver: sessionDrivers.memory()
  },
  image: {
    service: passthroughImageService()
  },

  adapter: cloudflare({
    imageService: 'passthrough',
    prerenderEnvironment: 'node',
    platformProxy: {
      enabled: true
    }
  }),

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['@astrojs/cloudflare']
    },
    build: {
      chunkSizeWarningLimit: 1500
    },
    server: {
      watch: {
        ignored: ['**/.wrangler/**']
      }
    }
  },

  integrations: [
    react()
  ]
});
