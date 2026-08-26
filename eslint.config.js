// eslint.config.js — Flat config ESLint 9.
// Cakupan: kode backend (lib, controllers, routes, middleware, scripts, tests).
// public/ diabaikan (frontend tanpa build step, environment browser terpisah).
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'public/**', 'dist/**', '.runtime/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Parameter/variabel berawalan _ sengaja tidak dipakai (konvensi project)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Logging wajib lewat pino (lib/logger.js) — console hanya untuk scripts CLI
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Script CLI/demo boleh console.log (output memang ditujukan ke terminal)
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
      // Regex emoji di dev script memang mengandung karakter gabungan
      'no-misleading-character-class': 'off',
    },
  },
  {
    // get-secret.js dievaluasi terhadap bundle situs yang mereferensikan
    // window/document. File ini GUARDRAIL (jangan ubah logikanya) — penyesuaian
    // lint dilakukan lewat konfigurasi, bukan edit file.
    files: ['scripts/get-secret.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-useless-escape': 'off',
    },
  },
  {
    // Callback page.evaluate berjalan DI BROWSER — `document` valid di sana.
    // Skrip probe/spike/qa adalah diagnostik sekali-pakai: longgar saja.
    files: ['scripts/dev/qa/**', 'scripts/dev/experiments/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
    },
  },
];
