import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // bcryptjs (cost 12) makes multi-hash request flows exceed the default
    // 5s per-test budget on slower machines. Allow the full suite to finish.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});