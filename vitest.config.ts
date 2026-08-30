import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
  },
});
