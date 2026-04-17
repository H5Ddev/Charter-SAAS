module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-namespace': 'warn',
    'no-console': 'warn',
    // Prevent cross-tenant data leaks: findUnique bypasses the tenantScope
    // Prisma extension because unique lookups don't support extra where filters.
    // Use findFirst with tenantScope() instead for tenant-scoped business models.
    // For non-tenant-scoped models (RefreshToken, UserMfaSettings), add an
    // eslint-disable-next-line comment with justification.
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='findUnique']",
        message:
          'findUnique bypasses tenantScope and risks cross-tenant data access. ' +
          'Use findFirst with tenantScope(tenantId, { ... }) instead. ' +
          'For non-tenant-scoped models only (e.g. RefreshToken, UserMfaSettings), ' +
          'add an eslint-disable-next-line comment with a justification.',
      },
    ],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/'],
}
