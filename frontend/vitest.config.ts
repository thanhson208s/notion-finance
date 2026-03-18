import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['api/__tests__/**/*.test.ts', 'agent/__test__/**/*.test.ts']
  }
});
