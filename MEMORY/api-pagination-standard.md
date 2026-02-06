

# API Pagination & List Endpoint Standards

## The Golden Rule
**ALL paginated list endpoints MUST return data in this exact format:**

### Response Structure
```typescript
{
  data: T[],           // Array of items (NOT "items", "results", etc.)
  meta: {              // Pagination metadata
    total: number,      // Total count
    page: number,       // Current page (1-indexed)
    limit: number,      // Items per page
    totalPages: number  // Calculated: Math.ceil(total / limit)
  }
}
```

## Backend (NestJS) Rules

### 1. DTO Standards
- Create a generic `PaginatedResponseDto<T>` in `src/common/dto/`
- All list endpoint responses MUST use this DTO
- Use `PaginationQueryDto` base class for query parameters
- Default values: `page=1`, `limit=20`
- Maximum limit: `100` (enforce with `@Max(100)`)

### 2. Service Layer
```typescript
async findAll(query: QueryDto): Promise<PaginatedResponseDto<EntityDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.repository.findAndCount({
        skip,
        take: limit,
    });

    return {
        data: items,  // ← MUST be "data"
        meta: {       // ← MUST be "meta"
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}
```

### 3. Forbidden Patterns
- ❌ `{ items: [], total, page, limit }` (flat structure)
- ❌ `{ results: [], count, pageNumber }` (wrong field names)
- ❌ `{ data: [], totalCount, currentPage }` (inconsistent meta fields)

## Frontend (Vue.js) Rules

### 1. TypeScript Types
```typescript
// Define once, reuse everywhere
export interface PaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}
```

### 2. API Layer
```typescript
// Always use PaginatedResponse<T> for list endpoints
getItems: (query?: { page?: number; limit?: number }) =>
    request<PaginatedResponse<Item>>('/items?...');
```

### 3. Store Layer
```typescript
// Pinia store pattern
const items = ref<Item[]>([]);
const pagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });

async function fetchItems(query?) {
    const response = await api.getItems(query);
    if (response.data) {
        items.value = response.data.data;      // ← Access .data.data
        pagination.value = response.data.meta; // ← Access .data.meta
    }
}
```

### 4. Forbidden Patterns
- ❌ Mapping backend response to different format in store
- ❌ Using `any` type instead of `PaginatedResponse<T>`
- ❌ Storing pagination fields separately from meta object

## Query Parameters Standard

### Required
- `page` (number, default: 1, min: 1)
- `limit` (number, default: 20, min: 1, max: 100)

### Optional (add as needed)
- `search` (string)
- `sortBy` (enum matching entity fields)
- `sortOrder` ('ASC' | 'DESC')
- Entity-specific filters (e.g., `categoryId`, `status`)

### Example
```
GET /api/forum/topics?page=2&limit=20&sortBy=createdAt&categoryId=123
```

## Exceptions

### When NOT to Paginate
- Very small, static lists (< 20 items, e.g., provinces, roles)
- Single-item GET endpoints
- Binary responses (file downloads)

### Alternative Patterns
- **Cursor-based**: For infinite scroll (use `{ data, cursor: { next, hasMore } }`)
- **Stream**: For real-time data (WebSocket/SSE)

## Migration Checklist

When you encounter a non-compliant endpoint:

### Backend
- [ ] Update DTO to use `PaginatedResponseDto<T>`
- [ ] Change `items` field to `data`
- [ ] Wrap pagination fields in `meta` object
- [ ] Update Swagger docs
- [ ] Test with frontend before merging

### Frontend
- [ ] Update API type to `PaginatedResponse<T>`
- [ ] Change access from `.items` to `.data.data`
- [ ] Change meta access to `.data.meta`
- [ ] Update store and components
- [ ] Remove any workaround code

## Enforcement
- **Code review requirement**: All new pagination endpoints must follow this standard
- **No exceptions**: Even for "quick prototypes" or "internal endpoints"
- **Migration priority**: Existing non-compliant endpoints should be migrated as encountered

## Quick Reference Card

```
✅ CORRECT                          ❌ WRONG
--------------------------------    --------------------------------
{ data: [...], meta: {...} }        { items: [...], total: 10 }
response.data.data                  response.data.items
response.data.meta                  response.data (flat)
PaginatedResponse<User>             any
Math.ceil(total / limit)            total / limit
page (1-indexed)                    offset (0-indexed)
```

---

**See Full Documentation:** `.agent/standards/api-pagination.md`
