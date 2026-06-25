/**
 * Shared pagination contract. All list endpoints return `{ data, meta }` —
 * never a flat array or `items`/`results`. Mirrors the frontend
 * PaginatedResponse<T> shape.
 */
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}

/** Wraps a page of rows + total count into the `{ data, meta }` envelope. */
export function paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
): Paginated<T> {
    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
