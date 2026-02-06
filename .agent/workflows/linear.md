---
description: Process a Linear issue automatically (Analyze -> Implement -> Review -> Report)
---

# Linear Task Processor Workflow

This workflow defines the standard operating procedure for handling Linear issues assigned to the AI agent.

## 1. Analysis & Clarification
- **Step:** Fetch the issue details using `get_issue`.
- **Action:** Read the title, description, and any attachments.
- **Decision:**
  - **IF** the requirements are ambiguous, vague, or missing critical context:
    - **Action:** Post a comment on the issue (`create_comment`) asking specific clarifying questions.
    - **Stop:** Do not proceed until answered.
  - **IF** clear: Proceed to step 2.

## 2. Start Development
- **Step:** Update issue status to **"In Progress"**.
- **Action:**
  - Create `implementation_plan.md` in the brain directory.
  - Plan the technical changes.
  - **(Optional)** Notify user for plan approval if the task is complex.

## 3. Implementation (The "Doing" Phase)
- **Step:** Execute the code changes.
- **Rules:**
  - Follow valid coding standards.
  - Ensure all TypeScript errors are resolved.
  - Verify changes locally (e.g., build, test).

## 4. Review Handover
- **Step:** Update issue status to **"Review"**.
  - *Note: If "Review" status does not exist, check available statuses. If unavailable, keep as "In Progress" and tag user/reviewer.*
- **Action:** Perform a self-review or run a final verification step.

## 5. Technical Reporting
- **Step:** Post a technical summary comment on the Linear issue.
- **Content:**
  - **What was done:** Bullet points of changes.
  - **Files modified:** List of key files.
  - **Verification:** How it was tested (e.g., "Tested via localhost:3000, verified email link").
  - **Next Steps:** Any follow-up actions required.
