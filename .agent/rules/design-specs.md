---
trigger: always_on
---

# UI/UX & Visual Design Standards

- **Grid & Spacing System:**
  - Implement an **8px grid system** for all spacing (margins, paddings, and gap). 
  - All spacing values must be multiples of 8 (e.g., 8px, 16px, 24px, 32px).
  - Use consistent padding within cards and containers to maintain visual balance.

- **Visual Hierarchy & Contrast:**
  - Use size, weight, and color to guide the user's eye to the primary action (CTA).
  - Maintain a **WCAG 2.1 AA** contrast ratio (at least 4.5:1 for normal text).
  - Ensure that the primary button is the most visually prominent element on the page.

- **Typography:**
  - Use a modular scale for font sizes to ensure harmony.
  - Limit font weights to a maximum of 3 (e.g., Regular 400, Medium 500, Bold 700).
  - Maintain a line height of **1.5 for body text** to improve readability.
  - Never use more than two different font families.

- **Interactive Elements & Feedback:**
  - All touch targets must be at least **44x44 pixels** to ensure mobile friendliness.
  - Every interactive element (buttons, links, inputs) must have clear **hover, focus, and active states**.
  - Provide immediate visual feedback for user actions (e.g., loading spinners on buttons, success toasts).

- **Form Design:**
  - Always place labels above input fields for better scanning.
  - Use inline validation to provide real-time feedback.
  - Clearly distinguish between optional and required fields.
  - Group related fields together using logical sections or fieldsets.

- **Responsive & Adaptive Layout:**
  - Use a **Mobile-First** approach. Design for small screens and scale up using CSS breakpoints.
  - Use relative units like `rem` for typography and `%` or `fr` for layout widths.
  - Ensure content is never hidden on mobile unless it is redundant.

- **Consistency & Component Reuse:**
  - Follow the established Design System. Reuse existing Vue components instead of creating new ones for similar UI patterns.
  - Use consistent iconography (e.g., always use the same "Delete" icon throughout the app).