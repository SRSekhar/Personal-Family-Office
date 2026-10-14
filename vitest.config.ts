import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Each workspace package may provide its own vitest.config.ts.
        projects: [
            'packages/*',
            'apps/cli',
            {
                test: {
                    name: 'dashboard-app',
                    include: ['apps/dashboard/tests/**/*.test.js']
                }
            },
            'scripts/dashboard'
        ]
    }
});
