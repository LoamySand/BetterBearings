const js = require('@eslint/js');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/coverage/',
      '**/*.min.js',
      '**/.cache/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '19.2', // react lives in client/node_modules, which the root lint can't see
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      ...prettierPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'no-console': 'warn',
      'no-unused-vars': 'warn',
      // React 19 no longer checks propTypes at runtime, so the rule only adds noise
      'react/prop-types': 'off',
      // React Compiler rules (react-hooks v7). Real refactors, done as Phase 3 touches these files; warn so CI gates on the rest
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**/*.js', '*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
];
