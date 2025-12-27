//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...tanstackConfig,
  {
    rules: {
      '@typescript-eslint/array-type': ['off'],
      '@typescript-eslint/no-unnecessary-condition': ['off'],
    },
  },
]
