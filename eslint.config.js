import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', '.firebase/**', 'artifacts/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    }
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
