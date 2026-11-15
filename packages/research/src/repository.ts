import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ResearchRun, ResearchRunRepository } from './contracts.js';

interface ResearchStoreDocument {
    readonly schemaVersion: 1;
    readonly runs: readonly ResearchRun[];
}

const MAX_STORE_BYTES = 10 * 1024 * 1024;

export class FileResearchRunRepository implements ResearchRunRepository {
    private writeQueue: Promise<void> = Promise.resolve();

    public constructor(private readonly filePath: string) {
        if (!filePath.trim()) {
            throw new RangeError('A local research repository path is required.');
        }
    }

    public async findByIdempotencyKey(key: string): Promise<ResearchRun | undefined> {
        const document = await this.readDocument();
        return document.runs.find((run) => run.idempotencyKey === key);
    }

    public async get(id: string): Promise<ResearchRun | undefined> {
        const document = await this.readDocument();
        return document.runs.find((run) => run.id === id);
    }

    public async save(run: ResearchRun): Promise<void> {
        const operation = this.writeQueue.then(async () => {
            const document = await this.readDocument();
            const runs = [...document.runs];
            const index = runs.findIndex((item) => item.id === run.id);
            if (index >= 0) {
                runs[index] = run;
            } else {
                if (runs.some((item) => item.idempotencyKey === run.idempotencyKey)) {
                    throw new Error('A research run already exists for this idempotency key.');
                }
                runs.push(run);
            }
            const next: ResearchStoreDocument = { schemaVersion: 1, runs };
            const serialized = JSON.stringify(next);
            if (Buffer.byteLength(serialized, 'utf8') > MAX_STORE_BYTES) {
                throw new RangeError('Research repository exceeds its 10 MiB safety limit.');
            }
            const directory = dirname(this.filePath);
            await mkdir(directory, { recursive: true, mode: 0o700 });
            const temporary = this.filePath + '.' + randomUUID() + '.tmp';
            try {
                const handle = await open(temporary, 'wx', 0o600);
                try {
                    await handle.writeFile(serialized, 'utf8');
                    await handle.sync();
                } finally {
                    await handle.close();
                }
                await rename(temporary, this.filePath);
            } finally {
                await rm(temporary, { force: true });
            }
        });
        this.writeQueue = operation.catch(() => undefined);
        await operation;
    }

    private async readDocument(): Promise<ResearchStoreDocument> {
        let raw: string;
        try {
            raw = await readFile(this.filePath, 'utf8');
        } catch (error) {
            if (isNodeError(error) && error.code === 'ENOENT') {
                return { schemaVersion: 1, runs: [] };
            }
            throw new Error('Unable to read the local research repository.', { cause: error });
        }
        if (Buffer.byteLength(raw, 'utf8') > MAX_STORE_BYTES) {
            throw new RangeError('Research repository exceeds its 10 MiB safety limit.');
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            throw new Error('Local research repository is not valid JSON.', { cause: error });
        }
        if (!isStoreDocument(parsed)) {
            throw new Error('Local research repository has an unsupported or invalid schema.');
        }
        return parsed;
    }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

function isStoreDocument(value: unknown): value is ResearchStoreDocument {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as { schemaVersion?: unknown; runs?: unknown };
    if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.runs)) {
        return false;
    }
    return candidate.runs.every((run: unknown) => {
        if (!run || typeof run !== 'object') {
            return false;
        }
        const item = run as { schemaVersion?: unknown; id?: unknown; idempotencyKey?: unknown };
        return item.schemaVersion === 1 && typeof item.id === 'string'
            && typeof item.idempotencyKey === 'string';
    });
}
