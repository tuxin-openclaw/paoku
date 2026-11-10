import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true 让同一局域网内的手机也能访问开发服务器
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
});
