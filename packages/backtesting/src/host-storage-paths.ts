import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

export interface BacktestStoragePaths {
    readonly catalogPath: string;
    readonly artifactDirectory: string;
}

export interface ResolveBacktestStoragePathsOptions {
    readonly env?: NodeJS.ProcessEnv;
    readonly homeDirectory?: string;
    readonly platform?: NodeJS.Platform;
    /** Override only for deterministic host tests; production defaults to process.cwd(). */
    readonly repositoryRoot?: string;
}

type PathApi = typeof posix;

function isWithin(pathApi: PathApi, parent: string, candidate: string): boolean {
    const rel = pathApi.relative(parent, candidate);
    return rel === '' || (!rel.startsWith('..' + pathApi.sep) && rel !== '..' && !pathApi.isAbsolute(rel));
}

/**
 * Resolve separate local paths for the historical backtesting catalog and immutable
 * source artifacts. This function does not create directories or initialize storage.
 */
export function resolveBacktestStoragePaths(
    options: ResolveBacktestStoragePathsOptions = {}
): BacktestStoragePaths {
    const platform = options.platform ?? process.platform;
    const pathApi: PathApi = platform === 'win32' ? win32 : posix;
    const env = options.env ?? process.env;
    const home = options.homeDirectory ?? homedir();
    const repositoryRootInput = options.repositoryRoot ?? process.cwd();

    const catalogOverride = env['PFO_BACKTEST_CATALOG_PATH'];
    const artifactOverride = env['PFO_BACKTEST_ARTIFACT_DIRECTORY'];
    const hasCatalogOverride = catalogOverride !== undefined;
    const hasArtifactOverride = artifactOverride !== undefined;

    let catalogPath: string;
    let artifactDirectory: string;
    if (hasCatalogOverride || hasArtifactOverride) {
        if (!hasCatalogOverride || !hasArtifactOverride) {
            throw new RangeError('Set both PFO_BACKTEST_CATALOG_PATH and PFO_BACKTEST_ARTIFACT_DIRECTORY, or neither.');
        }
        if (!catalogOverride || !artifactOverride) {
            throw new RangeError('Backtest storage path overrides must not be empty.');
        }
        catalogPath = catalogOverride;
        artifactDirectory = artifactOverride;
    } else {
        let dataRoot: string;
        if (platform === 'win32') {
            if (env['LOCALAPPDATA'] !== undefined && !pathApi.isAbsolute(env['LOCALAPPDATA'])) {
                throw new RangeError('LOCALAPPDATA must be an absolute path when set.');
            }
            dataRoot = env['LOCALAPPDATA'] || pathApi.join(home, 'AppData', 'Local');
        } else if (env['XDG_DATA_HOME'] !== undefined) {
            if (!pathApi.isAbsolute(env['XDG_DATA_HOME'])) {
                throw new RangeError('XDG_DATA_HOME must be an absolute path when set.');
            }
            dataRoot = env['XDG_DATA_HOME'];
        } else if (platform === 'darwin') {
            dataRoot = pathApi.join(home, 'Library', 'Application Support');
        } else {
            dataRoot = pathApi.join(home, '.local', 'share');
        }
        const appDataRoot = pathApi.join(dataRoot, 'PFO-OS');
        catalogPath = pathApi.join(appDataRoot, 'backtesting-catalog', 'catalog.sqlite');
        artifactDirectory = pathApi.join(appDataRoot, 'backtesting-artifacts');
    }

    if (!pathApi.isAbsolute(catalogPath) || !pathApi.isAbsolute(artifactDirectory)) {
        throw new RangeError('Backtest storage path overrides must both be absolute.');
    }
    if (!pathApi.isAbsolute(repositoryRootInput)) {
        throw new RangeError('Repository root must be an absolute path.');
    }

    catalogPath = pathApi.resolve(catalogPath);
    artifactDirectory = pathApi.resolve(artifactDirectory);
    const repositoryRoot = pathApi.resolve(repositoryRootInput);

    if (isWithin(pathApi, repositoryRoot, catalogPath) || isWithin(pathApi, repositoryRoot, artifactDirectory)) {
        throw new RangeError('Backtest catalog and artifacts must be stored outside the repository.');
    }
    const catalogDirectory = pathApi.dirname(catalogPath);
    if (isWithin(pathApi, catalogDirectory, artifactDirectory)
        || isWithin(pathApi, artifactDirectory, catalogDirectory)) {
        throw new RangeError('Backtest catalog and artifact directories must have separate directory trees.');
    }

    return Object.freeze({ catalogPath, artifactDirectory });
}
