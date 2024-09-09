import globals from 'globals';
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/**/*', '**/dist/**/*'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/strongly-recommended'],
  // Disable a set of rules that may conflict with prettier
  // You can safely remove this if you don't use prettier
  eslintConfigPrettier,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.mts', '**/*.vue'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },

    rules: {
      semi: ['error', 'always'],
      'comma-dangle': ['warn', 'always-multiline'],

      quotes: [
        'warn',
        'single',
        {
          avoidEscape: true,
        },
      ],

      'no-undef': ['error'],
      'no-control-regex': ['warn'],
    },
  },

  {
    files: ['packages/preload/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  {
    files: ['packages/renderer/**'],
    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.node).map(([key]) => [key, 'off'])),
        ...globals.browser,
      },
    },
  },

  {
    files: ['**/tests/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  {
    files: ['**/vite.config.*'],
    languageOptions: {
      globals: {
        ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, 'off'])),
        ...globals.node,
      },
    },
  },
];
