// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      proxy: {
        '/security-proxy': {
          target: 'http://98.84.67.160:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/security-proxy/, ''),
          secure: false,
        }
      }
    }
  }
});
