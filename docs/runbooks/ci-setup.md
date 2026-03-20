# CI/CD Setup Runbook

## Overview

This runbook documents the CI pipeline, branch protection rules, and secrets management for this repository.

## CI Pipeline

The CI pipeline runs on every pull request to `main` via GitHub Actions (`.github/workflows/ci.yml`).

### Jobs

| Job   | Triggers on  | What it does                                |
|-------|-------------|---------------------------------------------|
| Lint  | Every PR    | Runs linter for detected project type        |
| Test  | After lint  | Runs test suite                              |
| Build | After test  | Compiles/bundles the project                 |

### Supported project types (auto-detected)

- **Node.js** — `package.json` present: runs `npm run lint`, `npm test`, `npm run build`
- **Python** — `requirements.txt` or `pyproject.toml`: runs `ruff check`, `pytest`
- **Go** — `go.mod`: runs `golangci-lint`, `go test ./...`, `go build ./...`

## Branch Protection

Branch protection is enforced on `main` via the GitHub repository settings.

### Rules

- All CI checks (lint, test, build) must pass before merge
- 1 approving review required — must be the CTO (enforced via CODEOWNERS)
- Stale reviews are dismissed when new commits are pushed
- Conversations must be resolved before merge
- Force pushes are blocked
- Branch deletion is blocked

### Applying branch protection (one-time setup)

After creating the GitHub repository, run:

```bash
# Install GitHub CLI: https://cli.github.com
gh auth login

GITHUB_REPO=your-org/mdev \
REQUIRED_REVIEWER=cto-github-username \
bash scripts/setup-branch-protection.sh
```

### Updating CODEOWNERS

Edit `.github/CODEOWNERS` and replace `@org/cto` with the actual CTO GitHub username:

```
* @actual-cto-username
```

## Secrets Management

**Never commit secrets to the repository.** Use GitHub Actions secrets or a secrets manager.

### GitHub Actions secrets (recommended for CI)

Set secrets in: `GitHub repo → Settings → Secrets and variables → Actions`

Reference in workflows:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}
```

### Local development

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

```bash
cp .env.example .env
```

The `.gitignore` blocks `.env` files from being committed.

### Secret rotation

1. Update the secret value in GitHub Actions secrets.
2. Trigger a new deployment (secrets are injected at runtime).
3. Revoke the old secret from the issuing service.

## Adding a new workflow

1. Create `.github/workflows/<name>.yml`
2. Open a PR — branch protection applies to all workflows
3. Get CTO approval, verify CI passes, then merge

## Troubleshooting

**CI fails with "npm: command not found"** — The repo likely lacks a `package.json`. Add one or update the workflow for your project type.

**Branch protection blocks admin** — By default `enforce_admins: false`. Enable it for strict environments.

**CODEOWNERS review not required** — Ensure `require_code_owner_reviews: true` is set in branch protection (the setup script handles this).
