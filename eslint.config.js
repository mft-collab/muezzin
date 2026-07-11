import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', '.firebase/**', 'artifacts/**']
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Bu kod tabanında yaygın kullanılan örtük `any` — tam bir strict
      // migrasyon ayrı bir iş; şimdilik derleme kırmasın diye kapalı.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // react-hooks v7'nin React Compiler odaklı yeni kuralları: kod
      // tabanında yaygın (~zararsız, sadece performans/idiom önerisi)
      // desenlerle çakışıyor. Gerçek bug sınıfı olan rules-of-hooks/
      // exhaustive-deps 'error' kalır; bunlar 'warn'a düşürüldü —
      // dosya dosya gözden geçirilip düzeltilmesi ayrı bir takip işi.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn'
    }
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
