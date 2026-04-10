import js from '@eslint/js'

export default [
  {
    ignores: ['node_modules/**', 'eslint.config.mjs']
  },
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        Module: 'readonly',
        NodeHelper: 'readonly',
        Log: 'readonly',
        moment: 'readonly',
        console: 'readonly',
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': ['warn', { caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-var': 'error',
      'prefer-const': ['warn', { destructuring: 'all' }]
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
]
