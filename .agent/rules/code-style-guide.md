---
trigger: always_on
---

# General Code Quality & Architecture Rules

- **DRY (Don't Repeat Yourself) Principle:** - Never duplicate logic across the application. 
  - If a logic or utility is used in more than two places, refactor it into a shared service or utility function.

- **Modular Folder Structure:**
  - **Shared Directory:** Use `src/shared/` for code that is common across different modules (e.g., constants, decorators, filters).
  - **Utils Directory:** Use `src/utils/` for pure helper functions that don't depend on application state.
  - **Core Directory:** Use `src/core/` for essential features like authentication guards, global interceptors, or base configurations.

- **Single Responsibility Principle (SRP):**
  - Each function, class, or component should do one thing and do it well. 
  - Functions should ideally not exceed 20-30 lines of code.

- **Clean Imports:**
  - Group imports in a logical order: External libraries first, then internal alias-based imports (`@/`), then local relative imports.
  - Remove unused imports immediately.

- **Defensive Programming:**
  - Always handle potential `null` or `undefined` values using optional chaining (`?.`) or nullish coalescing (`??`).
  - Implement comprehensive error handling (try-catch blocks) for all asynchronous operations.

- **Environment & Secrets:**
  - Never hardcode API keys, secrets, or environment-specific URLs. 
  - Always use `.env` files and access them through a configuration service (e.g., NestJS ConfigService).

- **Documentation & Naming:**
  - Use self-descriptive names for variables and functions. Avoid abbreviations like `str`, `temp`, or `data`.
  - Add JSDoc comments for complex business logic to explain the "why" instead of the "how".