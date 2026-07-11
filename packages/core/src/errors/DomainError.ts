export class DomainError extends Error {
    public readonly code: string;

    public constructor(
        code: string,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);

        this.name = new.target.name;
        this.code = code;

        Object.setPrototypeOf(this, new.target.prototype);
    }

    public override toString(): string {
        return `[${this.code}] ${this.message}`;
    }

    public static validation(message: string): DomainError {
        return new DomainError('VALIDATION_ERROR', message);
    }

    public static notFound(message: string): DomainError {
        return new DomainError('NOT_FOUND', message);
    }

    public static conflict(message: string): DomainError {
        return new DomainError('CONFLICT', message);
    }

    public static unauthorized(message: string): DomainError {
        return new DomainError('UNAUTHORIZED', message);
    }

    public static forbidden(message: string): DomainError {
        return new DomainError('FORBIDDEN', message);
    }

    public static unexpected(message: string): DomainError {
        return new DomainError('UNEXPECTED_ERROR', message);
    }
}