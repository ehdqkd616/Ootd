// ESLint 9(flat config) 공통 설정 — 각 패키지의 `eslint src`가 이 파일을 찾아 쓴다
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/release/**'] },
  ...tseslint.configs['flat/recommended'],
];
