---
trigger: always_on
---

# Senior-Level Vue.js & Frontend Architecture Rules

- **Logic Decoupling (Composables):**
  - Extract complex business logic from components into **Composables** (`src/composables/`).
  - Components should be "thin" (view layer only), delegating state and logic to functions.
  - Use the "Plugin Pattern" or "Dependency Injection" (provide/inject) for cross-cutting concerns to avoid prop drilling.

- **Component Design Patterns:**
  - **Compound Components:** Use slots and internal state management for complex UI elements like Tabs, Steppers, or Selects to provide maximum flexibility to the consumer.
  - **Controlled vs. Uncontrolled:** Prefer the `v-model` pattern for controlled components to maintain a predictable unidirectional data flow.

- **State Management (Pinia) Best Practices:**
  - **Modular Stores:** Avoid a single "God Store". Create feature-specific stores (e.g., `authStore`, `productStore`).
  - **Encapsulated Actions:** Keep business logic inside actions; components should only trigger actions and not manipulate the state directly.
  - **Subscription Management:** Always clean up store subscriptions or manual watchers in `onUnmounted` to prevent memory leaks.

- **Performance Optimization:**
  - **Async Components:** Use `defineAsyncComponent` for route-level components and large third-party libraries to reduce the initial bundle size.
  - **Fine-grained Reactivity:** Use `shallowRef` or `shallowReactive` for large objects or arrays that don't need deep reactivity to save CPU cycles.
  - **Render Optimization:** Use `v-once` for static content and `v-memo` for expensive list items to minimize re-render calculations.

- **Strict Type Safety for UI:**
  - Use **Generic Components** (`<script setup lang="ts" generic="T">`) for reusable data-driven components (Tables, Lists, Selects).
  - Explicitly define interfaces for all Emits and Props; avoid `Object` or `Array` as generic types.

- **Advanced Error & Loading Patterns:**
  - Implement **Error Boundaries** or global error handlers to catch component-level crashes gracefully.
  - Use **Skeleton Screens** or `Suspense` for a better user experience during data fetching, avoiding sudden layout shifts (CLS).

- **Testing & Documentation:**
  - Aim for high coverage on "Business Logic Composables" using **Vitest**.
  - Document component props and events using JSDoc so they appear in IDE intellisense for other developers.

- **English-Only Codebase (Frontend):**
  - **Component Naming:** All Vue components and file names must be in English (e.g., `ProductList.vue`).
  - **i18n Implementation:** Never use hardcoded Turkish strings in templates. All UI text must use translation keys, and these keys must be defined in English (e.g., `$t('auth.login.title')`).
  - **State Management:** All Pinia store states, getters, and actions must be named in English.
  - **Styling:** CSS class names (if not using Tailwind) must be descriptive and in English.