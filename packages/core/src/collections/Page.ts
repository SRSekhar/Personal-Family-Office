import type { PageRequest } from './PageRequest.js';

export interface Page<T> {
    readonly items: readonly T[];
    readonly pageNumber: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
    readonly hasPreviousPage: boolean;
    readonly hasNextPage: boolean;
}

export class PageFactory {
    public static create<T>(
        items: readonly T[],
        request: PageRequest,
        totalItems: number
    ): Page<T> {

        const totalPages =
            totalItems === 0
                ? 0
                : Math.ceil(totalItems / request.pageSize);

        return {
            items,
            pageNumber: request.pageNumber,
            pageSize: request.pageSize,
            totalItems,
            totalPages,
            hasPreviousPage: request.pageNumber > 1,
            hasNextPage: request.pageNumber < totalPages
        };
    }
}