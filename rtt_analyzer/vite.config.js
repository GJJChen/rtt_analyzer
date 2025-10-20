import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  
  // 构建优化配置
  build: {
    // 增加 chunk 大小警告限制到 1000 kB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // 将 React 相关库分离到单独的 chunk
          'react-vendor': ['react', 'react-dom'],
          // 将 ECharts 分离到单独的 chunk（通常是最大的依赖）
          'echarts-vendor': ['echarts', 'echarts-for-react'],
          // 将 Tauri API 分离到单独的 chunk
          'tauri-vendor': [
            '@tauri-apps/api',
            '@tauri-apps/plugin-dialog',
            '@tauri-apps/plugin-fs',
            '@tauri-apps/plugin-opener',
            '@tauri-apps/plugin-shell'
          ],
          // 将 lucide-react 图标库分离
          'icons-vendor': ['lucide-react']
        }
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 压缩选项
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // 保留 console，方便调试
        drop_debugger: true
      }
    }
  }
}));
