import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        name: '@pfo/calculators',

        globals: true,

        environment: 'node',

        include: [
            'tests/**/*.test.ts'
        ],

        coverage: {
            provider: 'v8',

            reporter: [
                'text',
                'html',
                'lcov'
            ],

            reportsDirectory: './coverage',

            include: [
                'src/**/*.ts'
            ],

            exclude: [
                'src/index.ts',
                '**/*.d.ts'
            ]
        }
    }
});