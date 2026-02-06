

# TypeScript External API & Fetch Response Handling Rules

## 1. Response.json() Type Handling
- **Type Assertion Required:** When working with `fetch()` API in strict TypeScript mode, always use type assertion for `response.json()` since it returns `unknown` rather than `any`.
  - ✅ **Correct:** `const data = await response.json() as YourType;`
  - ❌ **Incorrect:** `const data: YourType = await response.json();` (This will cause TS2322 error in strict mode)
  
## 2. Runtime Validation (Recommended for Production)
- For critical external APIs, consider implementing runtime validation libraries like **Zod** or **class-validator** to ensure data integrity:
  ```typescript
  const rawData = await response.json();
  const data = YourTypeSchema.parse(rawData); // Using Zod
  ```

- Type assertion is acceptable for internal or trusted APIs, but always wrap external API calls in proper error handling.

## 3. Error Handling Best Practices
- Always check `response.ok` before attempting to parse JSON.
- Wrap external API calls in try-catch blocks and transform them into appropriate `HttpException` instances.
- Log the raw error context before converting to HttpException for debugging purposes.

## 4. Interface Design for External APIs
- Define clear TypeScript interfaces for all external API responses.
- Use `unknown` type for properties that may vary or are not guaranteed by the API contract.
- Document the source API and expected structure in JSDoc comments above the interface.

## 5. Type Safety vs Runtime Safety
- **Type Assertion (`as Type`):** Tells TypeScript "I know better" but provides NO runtime safety. Use only when you're confident about the API contract.
- **Type Guards:** Functions that perform runtime checks and narrow types. Preferred for untrusted data sources.
- **Validation Libraries:** Provide both type-level and runtime-level safety. Best for production-critical integrations.
