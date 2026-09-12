import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',

    // Better isolation (less flaky)
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Only scan test files we expect
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'coverage', 'src/test/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],

      // Count coverage only for logic layers (more meaningful at this stage)
      include: ['src/utils/**', 'src/api/**', 'src/store/**'],

      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        '**/__mocks__/**',
      ],
    },
  },
});
