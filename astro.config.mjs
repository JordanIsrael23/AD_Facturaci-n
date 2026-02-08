// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      proxy: {
        '/security-proxy': {
          target: 'https://98.84.67.160.nip.io',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/security-proxy/, ''),
          secure: false,
        },
        '/auditoria-proxy': {
          target: 'https://ro0c7gwb09.execute-api.us-east-1.amazonaws.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/auditoria-proxy/, ''),
          secure: false,
        }
      }
    }
  }
});
