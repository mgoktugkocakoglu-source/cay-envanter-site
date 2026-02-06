---
trigger: always_on
---

# ESLint & Prettier Code Quality Standards

## 1. General TypeScript Standards
- **No Explicit Any:** Never use the `any` type. If a type is unknown, use `unknown` and perform type-checking.
- **Unused Variables:** All variables, imports, and functions must be used. Follow the `@typescript-eslint/no-unused-vars` rule (exceptions allowed for variables prefixed with `_`).
- **Naming Conventions:** - Interfaces must not be prefixed with `I` (e.g., use `User` instead of `IUser`).
  - Enums must be `PascalCase`.
  - Variables and functions must be `camelCase`.
- **Prettier Integration:** All code must be formatted according to the project's `.prettierrc` configuration (2 spaces, single quotes, trailing commas).

## 2. Backend (NestJS / Node.js) Specifics
- **No Floating Promises:** All promises must be awaited or properly handled with `.catch()`. Use `@typescript-eslint/no-floating-promises`.
- **Await inside Loop:** Avoid using `await` inside loops; use `Promise.all()` for concurrent operations where possible.
- **Explicit Return Types:** All public methods in services and controllers must have an explicit return type to ensure API contract stability.
- **Member Ordering:** Maintain a consistent order in classes: private properties, constructor, public methods, private methods.

## 3. Frontend (Vue.js) Specifics
- **Multi-word Components:** All component names must consist of at least two words (e.g., `UserCard.vue` instead of `User.vue`) to avoid conflicts with HTML elements.
- **Prop Type Definitions:** Every prop must have a type and, if not required, a default value.
- **Template Order:** Follow the `vue/order-in-components` standard: `script`, `template`, `style`.
- **Directive Shorthands:** Always use shorthands (`:` for `v-bind`, `@` for `v-on`, `#` for `v-slot`).
- **No DOM Manipulation:** Never use `document.querySelector` or direct DOM manipulation. Use Vue `refs` or data binding.

## 4. Automation & Fixing
- **Auto-Fixing:** Prioritize writing code that can be automatically fixed by `eslint --fix`.
- **Commented-out Code:** Do not leave commented-out code blocks in the repository. Use Git history for reference.