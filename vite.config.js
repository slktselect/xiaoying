import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 纯前端构建：产物在 dist/，由 wrangler.toml 的 [assets] 直接托管。
// Worker（签名 / 视频分发）在 worker/ 目录，不参与打包。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 不设 public 目录：所有资源都走 src/ 里的 import 参与构建，
  // 避免 public/ 里的同名文件被原样拷进 dist 覆盖构建产物（历史上踩过）。
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // 本地联调：把 Worker 的接口代理到 wrangler dev(8787)。
    // 需要先在另一个终端跑 npm run dev:worker。
    proxy: {
      '/api': 'http://localhost:8787',
      '/v': 'http://localhost:8787',
    },
  },
});
