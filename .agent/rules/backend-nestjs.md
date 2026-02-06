---
trigger: always_on
---

# Senior NestJS & TypeScript Architecture Rules

## 1. Core Development Standards
- **Strict Typing:** Adhere to strict TypeScript mode. Avoid `any` and `unknown` (unless type-guarding). Use `Record<string, any>` only when absolutely necessary.
- **Dependency Injection:** Use constructor-based injection. Always use interface-based tokens or abstract classes for "Inversion of Control" when integrating external services.
- **Path Aliasing:** Use the `@` alias (mapped to `src/`) for all internal imports. No relative paths (e.g., `../../`).

## 2. Request Lifecycle & Consistency
- **Standardized Responses:** Use **Interceptors** to wrap all successful responses in a consistent JSON structure (e.g., `{ data: T, meta: { timestamp: string } }`).
- **Global Exception Filter:** Do not handle raw errors in controllers. Use a Global Exception Filter to catch, log, and format error responses (RFC 7807 compliance is preferred).
- **Validation Pipes:** Use `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true` to ensure no unexpected data enters the system.

## 3. Modular Architecture & Scalability
- **Feature Modules:** Each feature must be encapsulated. Use `exports` in Modules to share only what is necessary.
- **Service Responsibility (SRP):** Controllers must be "thin"—handling only routing and input validation. Business logic must reside in Services.
- **Cross-Cutting Concerns:** Use **Guards** for Authentication/Authorization and **Param Decorators** (e.g., `@CurrentUser()`) to extract logic from the request object.

## 4. Documentation & API Contracts
- **OpenAPI (Swagger):** Every controller and DTO must be decorated with `@nestjs/swagger` decorators (`@ApiProperty`, `@ApiOperation`, `@ApiResponse`). The API should be self-documenting and type-safe for the frontend.
- **DTOs for Every Input:** Never use Entity classes for request bodies. Use dedicated DTOs for `Create`, `Update`, and `Query` operations.

## 5. Observability & Performance
- **Structured Logging:** Use a custom `LoggerService` (e.g., Winston or Pino). Never use `console.log`. Every error must be logged with context and stack trace.
- **Environment Management:** Use `@nestjs/config` for all environment variables. Validate them on startup using `joi` or `class-validator` schemas.
- **Asynchronous Optimization:** Use `Promise.all()` for independent operations to reduce response times. Avoid blocking the event loop with heavy synchronous logic.

## 6. Testing Strategy
- **Unit Testing:** Every Service must have a corresponding `.spec.ts` file using Vitest/Jest. Focus on testing edge cases in business logic.
- **Integration Testing:** Use the `Test.createTestingModule` to perform integration tests for critical API flows, ensuring the DI container resolves correctly.
- **Mocking:** Always mock external dependencies (Databases, Mailers, 3rd party APIs) during unit tests.

- **English-Only Codebase (Backend):**
  - **Logic & Variables:** All variable names, function names, class names, and types must be in English.
  - **Database Schema:** Table names and column names in TypeORM entities must be strictly English (e.g., `invoice_items` instead of `fatura_kalemleri`).
  - **API Contracts:** All REST API endpoints, query parameters, and JSON response keys must use English terminology.
  - **Comments:** All JSDoc and inline comments must explain logic in English.