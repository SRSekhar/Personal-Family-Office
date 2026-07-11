export enum LogLevel {
    Trace = 'TRACE',
    Debug = 'DEBUG',
    Information = 'INFORMATION',
    Warning = 'WARNING',
    Error = 'ERROR',
    Critical = 'CRITICAL'
}

export interface LogEntry {
    readonly timestamp: Date;
    readonly level: LogLevel;
    readonly message: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly error?: Error;
}

export interface ILogger {
    trace(message: string, metadata?: Readonly<Record<string, unknown>>): void;
    debug(message: string, metadata?: Readonly<Record<string, unknown>>): void;
    information(message: string, metadata?: Readonly<Record<string, unknown>>): void;
    warning(message: string, metadata?: Readonly<Record<string, unknown>>): void;
    error(
        message: string,
        error?: Error,
        metadata?: Readonly<Record<string, unknown>>
    ): void;
    critical(
        message: string,
        error?: Error,
        metadata?: Readonly<Record<string, unknown>>
    ): void;
}

export class ConsoleLogger implements ILogger {

    public trace(message: string, metadata?: Readonly<Record<string, unknown>>): void {
        this.write(LogLevel.Trace, message, metadata);
    }

    public debug(message: string, metadata?: Readonly<Record<string, unknown>>): void {
        this.write(LogLevel.Debug, message, metadata);
    }

    public information(message: string, metadata?: Readonly<Record<string, unknown>>): void {
        this.write(LogLevel.Information, message, metadata);
    }

    public warning(message: string, metadata?: Readonly<Record<string, unknown>>): void {
        this.write(LogLevel.Warning, message, metadata);
    }

    public error(
        message: string,
        error?: Error,
        metadata?: Readonly<Record<string, unknown>>
    ): void {
        this.write(LogLevel.Error, message, metadata, error);
    }

    public critical(
        message: string,
        error?: Error,
        metadata?: Readonly<Record<string, unknown>>
    ): void {
        this.write(LogLevel.Critical, message, metadata, error);
    }

    private write(
    level: LogLevel,
    message: string,
    metadata?: Readonly<Record<string, unknown>>,
    error?: Error
): void {

    const entry: LogEntry = {
        timestamp: new Date(),
        level,
        message,
        ...(metadata !== undefined ? { metadata } : {}),
        ...(error !== undefined ? { error } : {})
    };

    console.log({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
        ...(entry.error !== undefined ? { error: entry.error.message } : {})
    });
}
}