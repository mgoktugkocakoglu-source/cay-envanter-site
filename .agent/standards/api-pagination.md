# API Pagination Standard

## Overview
This document defines the standard format for paginated list endpoints across the application. All list endpoints MUST follow this standard to ensure consistency between frontend and backend.

---

## Backend Standard (NestJS)

### 1. Response Format
All paginated endpoints must return responses in the following format:

```typescript
{
  data: T[],           // Array of items
  meta: {
    total: number,      // Total number of items
    page: number,       // Current page number (1-indexed)
    limit: number,      // Items per page
    totalPages: number  // Total number of pages
  }
}
```

### 2. DTO Structure

#### Generic Paginated Response DTO
Create a generic base DTO that can be reused:

```typescript
// src/common/dto/paginated-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
    @ApiProperty({ description: 'Total number of items' })
    total: number;

    @ApiProperty({ description: 'Current page number' })
    page: number;

    @ApiProperty({ description: 'Number of items per page' })
    limit: number;

    @ApiProperty({ description: 'Total number of pages' })
    totalPages: number;
}

export class PaginatedResponseDto<T> {
    @ApiProperty({ description: 'Array of items', isArray: true })
    data: T[];

    @ApiProperty({ type: PaginationMetaDto })
    meta: PaginationMetaDto;
}
```

#### Query DTO
All list endpoints should accept pagination query parameters:

```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}
```

### 3. Service Implementation
Use TypeORM's `getManyAndCount()` for efficient pagination:

```typescript
async findAll(query: PaginationQueryDto): Promise<PaginatedResponseDto<EntityDto>> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await this.repository.findAndCount({
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
    });

    return {
        data: items.map(item => this.toDto(item)),
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}
```

### 4. Controller Response
Document the response type properly:

```typescript
@Get()
@ApiOperation({ summary: 'Get all items' })
@ApiResponse({ status: 200, type: PaginatedResponseDto })
async findAll(@Query() query: PaginationQueryDto) {
    return this.service.findAll(query);
}
```

### 5. Naming Conventions
- **DO** use `data` for the items array
- **DO** use `meta` for pagination metadata
- **DO NOT** use `items`, `results`, or other variations
- **DO NOT** use flat structure (total, page at root level)

---

## Frontend Standard (Vue.js + TypeScript)

### 1. TypeScript Interface
Define a generic paginated response type:

```typescript
// src/types/api.ts or src/services/api.ts
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

### 2. API Service
Use the generic type in API calls:

```typescript
// src/services/api.ts
export const api = {
    getItems: (query?: { page?: number; limit?: number }) => {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        
        return request<PaginatedResponse<ItemType>>(
            `/items${params.toString() ? `?${params}` : ''}`
        );
    },
};
```

### 3. Pinia Store
Handle paginated responses consistently:

```typescript
// src/stores/itemStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api, type PaginatedResponse, type Item } from '@/services/api';

export const useItemStore = defineStore('item', () => {
    const items = ref<Item[]>([]);
    const pagination = ref({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
    });
    const loading = ref(false);

    async function fetchItems(query?: { page?: number; limit?: number }) {
        loading.value = true;
        try {
            const response = await api.getItems(query);
            if (response.data) {
                items.value = response.data.data;
                pagination.value = response.data.meta;
            }
        } finally {
            loading.value = false;
        }
    }

    return { items, pagination, loading, fetchItems };
});
```

### 4. Component Usage
Access pagination data from the store:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useItemStore } from '@/stores/itemStore';

const itemStore = useItemStore();

onMounted(() => {
    itemStore.fetchItems({ page: 1, limit: 20 });
});

function handlePageChange(page: number) {
    itemStore.fetchItems({ page, limit: itemStore.pagination.limit });
}
</script>

<template>
    <div>
        <div v-for="item in itemStore.items" :key="item.id">
            {{ item.name }}
        </div>
        
        <div class="pagination">
            <span>Page {{ itemStore.pagination.page }} of {{ itemStore.pagination.totalPages }}</span>
            <span>Total: {{ itemStore.pagination.total }} items</span>
        </div>
    </div>
</template>
```

---

## Migration Guide

### Existing Non-Compliant Endpoints

#### Backend Migration
If you have an existing endpoint returning a different format (e.g., `items` instead of `data`):

**Before:**
```typescript
{
    items: [...],
    total: 100,
    page: 1,
    limit: 20,
    totalPages: 5
}
```

**After:**
```typescript
{
    data: [...],
    meta: {
        total: 100,
        page: 1,
        limit: 20,
        totalPages: 5
    }
}
```

**Steps:**
1. Update the DTO to use `PaginatedResponseDto<T>`
2. Update the service to return the new format
3. Update Swagger documentation
4. Coordinate with frontend team for simultaneous deployment

#### Frontend Migration
Update the store to handle the new format:

```typescript
// OLD - Direct flat access
topics.value = backendData.items;
pagination.value = {
    total: backendData.total,
    page: backendData.page,
    // ...
};

// NEW - Structured access
topics.value = response.data.data;
pagination.value = response.data.meta;
```

---

## Checklist

### Backend Developer
- [ ] Response DTO extends or matches `PaginatedResponseDto<T>`
- [ ] Response has `data` field (not `items`, `results`, etc.)
- [ ] Response has `meta` object with all required fields
- [ ] Query DTO accepts `page` and `limit` parameters
- [ ] Default values are set (page=1, limit=20)
- [ ] Maximum limit is enforced (e.g., 100)
- [ ] Swagger documentation is complete
- [ ] `totalPages` is calculated correctly: `Math.ceil(total / limit)`

### Frontend Developer
- [ ] API call uses `PaginatedResponse<T>` type
- [ ] Store separates `data` and `meta` clearly
- [ ] Components access pagination via store
- [ ] Loading states are handled
- [ ] Page change triggers new API call with updated `page` parameter
- [ ] Limit change (if supported) triggers new API call

---

## Examples

### Complete Example: User List Endpoint

#### Backend
```typescript
// dto/user-list.dto.ts
export class UserListQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;
}

// user.service.ts
async findAll(query: UserListQueryDto): Promise<PaginatedResponseDto<UserDto>> {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    if (search) {
        queryBuilder.where('user.name ILIKE :search', { search: `%${search}%` });
    }

    const [items, total] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

    return {
        data: items,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// user.controller.ts
@Get()
@ApiResponse({ status: 200, type: PaginatedResponseDto })
async findAll(@Query() query: UserListQueryDto) {
    return this.userService.findAll(query);
}
```

#### Frontend
```typescript
// services/api.ts
export interface User {
    id: string;
    name: string;
    email: string;
}

export const api = {
    getUsers: (query?: { page?: number; limit?: number; search?: string }) => {
        const params = new URLSearchParams();
        if (query?.page) params.append('page', query.page.toString());
        if (query?.limit) params.append('limit', query.limit.toString());
        if (query?.search) params.append('search', query.search);
        
        return request<PaginatedResponse<User>>(
            `/users${params.toString() ? `?${params}` : ''}`
        );
    },
};

// stores/userStore.ts
export const useUserStore = defineStore('user', () => {
    const users = ref<User[]>([]);
    const pagination = ref({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
    });

    async function fetchUsers(query?: { page?: number; limit?: number; search?: string }) {
        const response = await api.getUsers(query);
        if (response.data) {
            users.value = response.data.data;
            pagination.value = response.data.meta;
        }
    }

    return { users, pagination, fetchUsers };
});
```

---

## Exceptions

### When NOT to Use Pagination
- **Small, Static Lists**: e.g., list of provinces, list of enum values (< 50 items)
- **Infinite Scroll**: Use cursor-based pagination instead
- **Real-time Feeds**: May require different strategies

### Alternative: Cursor-Based Pagination
For infinite scroll or high-performance scenarios:

```typescript
{
    data: T[],
    cursor: {
        next: string | null,
        hasMore: boolean
    }
}
```

**Only use this for specific use cases. Default to offset-based pagination.**

---

## Enforcement

### Code Review
- All new paginated endpoints must follow this standard
- PRs with non-compliant pagination will be rejected
- Migration PRs for existing endpoints are encouraged

### Linting (Future)
Consider adding custom ESLint/TSLint rules to enforce:
- Response type checking
- Proper field names (`data` vs `items`)

---

## Related Documentation
- [Backend NestJS Architecture Rules](../../MEMORY/backend-nestjs.md)
- [Frontend Vue.js Standards](../../MEMORY/frontend-specs.md)
- [API Design Guidelines](./api-design.md) _(if exists)_

---

**Last Updated:** 2026-01-28  
**Version:** 1.0.0
