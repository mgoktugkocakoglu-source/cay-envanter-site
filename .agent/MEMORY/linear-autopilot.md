
# AI Autopilot & Linear Operations Rules

## 1. Automatic Task Discovery
- **Trigger:** At the start of any new session or when specifically asked to check status/tasks, the agent MUST query Linear for "AI-ready" tasks.
- **Criteria for Autopilot:**
  - **Team:** "Çay Hesabım"
  - **Status:** `Todo` (or any equivalent "unstarted" state)
  - **Label:** `AI`
- **Priority Handling:** If multiple tasks meet these criteria, process them based on Linear priority (Urgent > High > Normal).

## 2. Initialization Workflow
1. Use `list_issues` with label "AI".
2. Filter for state: `Todo`.
3. Select the most relevant task.
4. Automatically transition to **PLANNING** mode and create an `implementation_plan.md`.
5. Update the Linear issue state to `In Progress` (if possible) or acknowledge the pickup in the chat.

## 3. Remote Command Protocol (Mobile Control)
- **Concept:** The user can send direct commands via Linear mobile app while away from the PC.
- **Trigger:**
  - Issue Title starts with `CMD:` (case-insensitive)
  - Label: `AI`
  - Status: `Todo`
- **Agent Action:**
  1. Detect the "CMD" prefix.
  2. Treat the Issue Description as a prompt/instruction (NOT a coding task).
  3. Execute the command (e.g., "Check server status", "Run tests", "Reset API").
  4. Post the result as a **Comment** on the issue.
  5. Close the issue (Status: `Done` or `Canceled`).

## 4. Communication
- Upon finding an AI-labeled task, inform the user: "Found urgent task in Linear with AI label: [Issue Title]. Starting Planning..."
- Do not wait for manual user confirmation to *start* planning, unless the task is marked as highly ambiguous.
