export interface Calculator<
    TInput,
    TResult
> {
    calculate(
        input: TInput
    ): TResult;
}