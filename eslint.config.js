import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/*.d.ts'
        ]
    },

    js.configs.recommended,

    ...tseslint.configs.strictTypeChecked,

    {
        // JavaScript tooling/config files are not part of the TypeScript project.
        files: ['**/*.{js,cjs,mjs}'],
        extends: [tseslint.configs.disableTypeChecked]
    },

    {
        files: ['**/*.ts'],

        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.base.json'],
                tsconfigRootDir: import.meta.dirname
            },

            globals: {
                ...globals.node
            }
        },

        rules: {
            '@typescript-eslint/array-type': [
                'error',
                {
                    default: 'array-simple'
                }
            ],

            '@typescript-eslint/consistent-type-imports': 'error',

            '@typescript-eslint/explicit-function-return-type': 'error',

            '@typescript-eslint/no-explicit-any': 'error',

            '@typescript-eslint/no-floating-promises': 'error',

            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_'
                }
            ],

            '@typescript-eslint/prefer-readonly': 'error',

            'no-console': 'warn',

            'no-debugger': 'error',

            'eqeqeq': [
                'error',
                'always'
            ],

            'curly': [
                'error',
                'all'
            ]
        }
    },
    {
        files: [
            '**/src/guard/Guard.ts',
            '**/src/collections/Page.ts'
        ],

        rules: {
            '@typescript-eslint/no-extraneous-class': 'off'
        }
    },
    {
        files: [
            '**/src/configuration/Configuration.ts'
        ],

        rules: {
            '@typescript-eslint/no-unnecessary-type-parameters': 'off'
        }
    },
    {
        files: [
            '**/src/logging/Logger.ts'
        ],

        rules: {
            'no-console': 'off'
        }
    }
);
