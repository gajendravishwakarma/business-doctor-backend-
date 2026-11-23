import { defineConfig } from 'vitest/config';

// Keep the test process explicitly isolated from any inherited deployment environment.
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    environment: 'node',
  },
});
