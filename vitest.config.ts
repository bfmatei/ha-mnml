import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/{contract,templates,home,theme,build}/**/*.test.ts',
            'tools/**/*.test.ts',
            'demo/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'browser',
          environment: 'jsdom',
          include: ['src/{cards,ha,store,editors,panel,test}/**/*.test.ts'],
        },
      },
    ],
  },
});
