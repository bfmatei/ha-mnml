import { defineConfig } from 'oxfmt';

export default defineConfig({
  ignorePatterns: ['.ha/**', 'out/**', '.venv/**', 'custom_components/mnml/www/**', 'uv.lock'],
  singleQuote: true,
  sortImports: {
    groups: [
      'builtin',
      { newlinesBetween: true },
      'external',
      { newlinesBetween: true },
      ['parent'],
      { newlinesBetween: true },
      ['sibling', 'index'],
    ],
    newlinesBetween: true,
  },
  sortPackageJson: true,
});
