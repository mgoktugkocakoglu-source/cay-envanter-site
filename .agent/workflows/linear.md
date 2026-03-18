---
description: Process a Linear issue automatically (Analyze -> Implement -> Deploy -> Monitor -> Report)
---

# Linear Task Processor Workflow

This workflow defines the standard operating procedure for handling Linear issues assigned to the AI agent.

**GitHub Repo:** `localdeveloment-oss/cayhesabim`
**Branch Strategy:** Direct push to `main`
**Pipeline:** `.github/workflows/deploy.yml` — Test & Lint → Deploy via SSH (Docker Compose)

## 1. Analysis & Clarification
- **Step:** Fetch the issue details using `get_issue` (Linear MCP).
- **Action:** Read the title, description, and any attachments.
- **Decision:**
  - **IF** the requirements are ambiguous, vague, or missing critical context:
    - **Action:** Post a comment on the issue (`save_comment`) asking specific clarifying questions.
    - **Stop:** Do not proceed until answered.
  - **IF** clear: Proceed to step 2.

## 2. Start Development
- **Step:** Update issue status to **"In Progress"** (Linear MCP: `save_issue`).
- **Action:**
  - Create `implementation_plan.md` in the brain directory.
  - Plan the technical changes.
  - **(Optional)** Notify user for plan approval if the task is complex.

## 3. Implementation (The "Doing" Phase)
- **Step:** Execute the code changes.
- **Rules:**
  - Follow valid coding standards (see `.agent/rules/`).
  - Ensure all TypeScript errors are resolved.
  - Verify changes locally (e.g., `pnpm build:api`, `pnpm build:web`).

## 4. Git Push & Deploy
- **Step:** Push changes to `main` branch.
- **Action:**
  - Use `git add`, `git commit` (Conventional Commits format), and `git push origin main`.
  - Commit message format: `feat(scope): description` or `fix(scope): description`.

## 5. Pipeline Monitoring & Auto-Fix
- **Step:** Monitor GitHub Actions deployment pipeline.
- **Action:**
  1. Wait ~60 seconds for the pipeline to start.
  2. Use GitHub MCP `list_commits` to get the latest commit SHA on `main`.
  3. Check pipeline status:
     - Use web search or GitHub MCP to check recent workflow runs.
     - The pipeline has 2 jobs: `test` (lint + tests) and `deploy` (SSH to server).
  4. **IF pipeline fails:**
     - Read the error logs from the GitHub Actions run.
     - Identify the root cause (lint error, test failure, Docker build error, SSH/deploy error).
     - Fix the issue locally.
     - Push the fix to `main` again.
     - Repeat monitoring until pipeline succeeds.
  5. **IF pipeline succeeds:**
     - Verify the deployment by checking `APP_URL/api/health` if accessible.
     - Proceed to step 6.

## 6. Review Handover
- **Step:** Update issue status to **"Review"** (Linear MCP: `save_issue`).
  - *Note: If "Review" status does not exist, check available statuses with `list_issue_statuses`. If unavailable, keep as "In Progress" and tag user/reviewer.*
- **Action:** Perform a self-review or run a final verification step.

## 7. Technical Reporting
- **Step:** Post a technical summary comment on the Linear issue (`save_comment`).
- **Content:**
  - **What was done:** Bullet points of changes.
  - **Files modified:** List of key files.
  - **Deployment:** Pipeline status (✅/❌), commit SHA, any fixes applied.
  - **Verification:** How it was tested (e.g., "Build passed, deployed to production, health check OK").
  - **Next Steps:** Any follow-up actions required.
- **Step:** Update issue status to **"Done"** if fully verified.
