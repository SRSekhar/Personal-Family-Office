import type { Page } from './Page.js';

export class PagedResult<T> {
    public constructor(
        public readonly page: Page<T>
    ) {}

    public get items(): readonly T[] {
        return this.page.items;
    }

    public get pageNumber(): number {
        return this.page.pageNumber;
    }

    public get pageSize(): number {
        return this.page.pageSize;
    }

    public get totalItems(): number {
        return this.page.totalItems;
    }

    public get totalPages(): number {
        return this.page.totalPages;
    }

    public get hasPreviousPage(): boolean {
        return this.page.hasPreviousPage;
    }

    public get hasNextPage(): boolean {
        return this.page.hasNextPage;
    }
}