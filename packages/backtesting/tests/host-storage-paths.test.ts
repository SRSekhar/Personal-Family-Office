import { describe, expect, it } from 'vitest';

import { resolveBacktestStoragePaths } from '../src/host-storage-paths.js';

describe('resolveBacktestStoragePaths', () => {
    it('uses Windows LocalAppData and sibling catalog/artifact roots', () => {
        expect(resolveBacktestStoragePaths({
            platform: 'win32',
            homeDirectory: 'C:\\Users\\Sekhar',
            repositoryRoot: 'C:\\work\\pfo',
            env: { LOCALAPPDATA: 'C:\\Users\\Sekhar\\AppData\\Local' }
        })).toEqual({
            catalogPath: 'C:\\Users\\Sekhar\\AppData\\Local\\PFO-OS\\backtesting-catalog\\catalog.sqlite',
            artifactDirectory: 'C:\\Users\\Sekhar\\AppData\\Local\\PFO-OS\\backtesting-artifacts'
        });
    });

    it('uses XDG_DATA_HOME on non-Windows hosts', () => {
        expect(resolveBacktestStoragePaths({
            platform: 'linux',
            homeDirectory: '/home/sekhar',
            repositoryRoot: '/work/pfo',
            env: { XDG_DATA_HOME: '/mnt/private-data' }
        })).toEqual({
            catalogPath: '/mnt/private-data/PFO-OS/backtesting-catalog/catalog.sqlite',
            artifactDirectory: '/mnt/private-data/PFO-OS/backtesting-artifacts'
        });
    });

    it('uses the macOS Application Support directory when XDG_DATA_HOME is absent', () => {
        expect(resolveBacktestStoragePaths({
            platform: 'darwin',
            homeDirectory: '/Users/sekhar',
            repositoryRoot: '/work/pfo',
            env: {}
        })).toEqual({
            catalogPath: '/Users/sekhar/Library/Application Support/PFO-OS/backtesting-catalog/catalog.sqlite',
            artifactDirectory: '/Users/sekhar/Library/Application Support/PFO-OS/backtesting-artifacts'
        });
    });

    it('falls back to the user data directory when XDG_DATA_HOME is absent', () => {
        expect(resolveBacktestStoragePaths({
            platform: 'linux',
            homeDirectory: '/home/sekhar',
            repositoryRoot: '/work/pfo',
            env: {}
        })).toEqual({
            catalogPath: '/home/sekhar/.local/share/PFO-OS/backtesting-catalog/catalog.sqlite',
            artifactDirectory: '/home/sekhar/.local/share/PFO-OS/backtesting-artifacts'
        });
    });

    it('requires both explicit overrides and accepts an absolute disjoint pair', () => {
        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: { PFO_BACKTEST_CATALOG_PATH: '/var/lib/pfo/catalog.sqlite' }
        })).toThrow(/set both/i);

        expect(resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: {
                PFO_BACKTEST_CATALOG_PATH: '/var/lib/pfo/catalog.sqlite',
                PFO_BACKTEST_ARTIFACT_DIRECTORY: '/var/lib/pfo/artifacts'
            }
        })).toEqual({
            catalogPath: '/var/lib/pfo/catalog.sqlite',
            artifactDirectory: '/var/lib/pfo/artifacts'
        });
    });

    it('rejects empty and relative overrides and relative XDG data roots', () => {
        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: { PFO_BACKTEST_CATALOG_PATH: '', PFO_BACKTEST_ARTIFACT_DIRECTORY: '/var/lib/pfo/artifacts' }
        })).toThrow(/must not be empty/i);
        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: { PFO_BACKTEST_CATALOG_PATH: 'catalog.sqlite', PFO_BACKTEST_ARTIFACT_DIRECTORY: '/var/lib/pfo/artifacts' }
        })).toThrow(/absolute/i);
        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo', env: { XDG_DATA_HOME: 'relative-data' }
        })).toThrow(/XDG_DATA_HOME/i);
    });

    it('rejects nested storage trees and any path inside the repository', () => {
        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: {
                PFO_BACKTEST_CATALOG_PATH: '/var/lib/pfo/catalog/catalog.sqlite',
                PFO_BACKTEST_ARTIFACT_DIRECTORY: '/var/lib/pfo/catalog/artifacts'
            }
        })).toThrow(/separate directory trees/i);

        expect(() => resolveBacktestStoragePaths({
            platform: 'linux', repositoryRoot: '/work/pfo',
            env: {
                PFO_BACKTEST_CATALOG_PATH: '/work/pfo/data/catalog.sqlite',
                PFO_BACKTEST_ARTIFACT_DIRECTORY: '/var/lib/pfo/artifacts'
            }
        })).toThrow(/outside the repository/i);
    });
});
