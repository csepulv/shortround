// Copied from reusableblocs (`packages/toolchain/src/eslint.config.js`, 2026-09-30) so the public repo can use it
// without the private toolchain package. Additions here: this repo's ignores, Storybook's rules for stories, and an
// explicit React version (the root has no `react` to detect, so `detect` would lint as the latest React).
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/storybook-static/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        // vitest globals
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'simple-import-sort/imports': 'error',
      'react/jsx-sort-props': 'error',
      'react/prop-types': 'off',
      'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: false }],
      curly: 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    },
    settings: {
      react: { version: '18.2' }
    }
  },
  ...storybook.configs['flat/recommended']
];
