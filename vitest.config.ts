import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          pool: 'threads',
          include: [
            'src/{contract,interface,templates,home,builder,theme,build,words}/**/*.test.ts',
            'tools/**/*.test.ts',
            'demo/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'browser',
          environment: 'jsdom',
          pool: 'threads',
          include: ['src/{cards,ha,store,editors,panel,test,strategy}/**/*.test.ts'],
        },
      },
    ],
  },
});
