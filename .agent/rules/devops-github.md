---
trigger: always_on
---

# Senior DevOps & GitHub Infrastructure Rules

## 1. Branching Strategy & Workflow
- **Branching Model:** Use **GitHub Flow**. All development must happen in feature branches (`feat/`, `fix/`, `refactor/`, `chore/`).
- **Main Branch Protection:** The `main` branch must be protected. No direct pushes are allowed. All changes must go through a Pull Request (PR).
- **Short-lived Branches:** Merge feature branches frequently to avoid "Merge Hell." Stale branches (older than 2 weeks) should be audited or deleted.

## 2. Commit Message Standards (Conventional Commits)
- **Format:** All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification: `<type>(scope): <description>`.
- **Types:** Use `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- **Atomic Commits:** Each commit should represent a single logical change. Avoid "mega-commits" containing multiple unrelated features.

## 3. Pull Request (PR) Discipline
- **PR Templates:** Every PR must include a description of the change, related issue links (e.g., `Closes #123`), and a checklist for testing.
- **Mandatory Reviews:** At least one approved review is required before merging.
- **Status Checks:** All CI checks (Linting, Unit Tests, Security Scans) must pass before a PR is eligible for merging.
- **Squash & Merge:** Prefer "Squash and Merge" to keep the `main` branch history clean and readable.

## 4. CI/CD & Automation (GitHub Actions)
- **Continuous Integration (CI):** Every push to a PR must trigger an automated pipeline that:
  - Runs ESLint/Prettier checks.
  - Executes Unit Tests (Vitest/Jest).
  - Performs Security Scans (Secret scanning and Dependency auditing).
- **Continuous Deployment (CD):** Merges to `main` should trigger an automated deployment to a Staging or Production environment.

## 5. Security & Secret Management
- **Zero Secrets Policy:** Never commit secrets, API keys, or `.env` files. Use **GitHub Secrets** for sensitive values.
- **Environment Separation:** Use GitHub Environments (e.g., `production`, `staging`) to manage environment-specific variables and protection rules.
- **Dependency Auditing:** Enable **Dependabot** to automatically identify and create PRs for vulnerable dependencies.

## 6. Versioning & Releases
- **Semantic Versioning (SemVer):** Follow `vMAJOR.MINOR.PATCH` (e.g., `v1.2.3`).
- **Automated Releases:** Use tags to trigger release workflows. Every production deployment should have a corresponding GitHub Release with an auto-generated changelog.