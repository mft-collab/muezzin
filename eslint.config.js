import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
