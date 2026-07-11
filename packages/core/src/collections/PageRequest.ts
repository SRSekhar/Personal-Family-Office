import { SortDirection } from './SortDirection.js';

export interface PageRequest {
    readonly pageNumber: number;
    readonly pageSize: number;
    readonly sortBy?: string;
    readonly sortDirection?: SortDirection;
}