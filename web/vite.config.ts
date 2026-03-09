import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.xlsx'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React core — rarely changes
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            // Charting — heavy, only used on Statistics page
            if (id.includes('/@antv/') || id.includes('/d3-')) {
              return 'vendor-charts';
            }
            // Ant Design UI — changes with upgrades
            if (id.includes('/antd/') || id.includes('/@ant-design/')) {
              return 'vendor-antd';
            }
            // Small utilities — stable
            if (
              id.includes('/dayjs/') ||
              id.includes('/axios/') ||
              id.includes('/zustand/') ||
              id.includes('/i18next/') ||
              id.includes('/react-i18next/')
            ) {
              return 'vendor-utils';
            }
          }
        },
      },
    },
  },
});
