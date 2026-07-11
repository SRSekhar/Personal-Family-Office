export class Result<T> {
    private constructor(
        public readonly isSuccess: boolean,
        public readonly value?: T,
        public readonly error?: string
    ) {}

    public static success<T>(value: T): Result<T> {
        return new Result<T>(true, value);
    }

    public static failure<T>(error: string): Result<T> {
        return new Result<T>(false, undefined, error);
    }

    public get isFailure(): boolean {
        return !this.isSuccess;
    }
}