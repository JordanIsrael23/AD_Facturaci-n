// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      proxy: {
        '/security-proxy': {
          target: 'https://api-seguridad.sistemanh.shop',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/security-proxy/, ''),
          secure: false, 
        }
      }
    }
  }
});
