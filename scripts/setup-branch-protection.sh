#!/usr/bin/env bash
# setup-branch-protection.sh
# Applies branch protection rules to main branch via GitHub API.
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - GITHUB_REPO set to "owner/repo" (e.g. "myorg/mdev")
#
# Usage:
#   GITHUB_REPO=myorg/mdev bash scripts/setup-branch-protection.sh

set -euo pipefail

REPO="${GITHUB_REPO:?Set GITHUB_REPO=owner/repo}"
BRANCH="main"

echo "Applying branch protection to ${REPO}:${BRANCH}..."

# Get the CI status check context names (must match workflow job names exactly)
CI_CHECKS='["Lint","Test","Build"]'

# CTO team or user that must approve — update this to the actual GitHub user/team slug
# To use a team: set REQUIRED_REVIEWER to "org/team-slug"
# To use a user: set REQUIRED_REVIEWER to the GitHub username
REQUIRED_REVIEWER="${REQUIRED_REVIEWER:-}"

if [ -z "$REQUIRED_REVIEWER" ]; then
  echo "WARNING: REQUIRED_REVIEWER not set. CTO reviewer will not be configured."
  REVIEWERS_PAYLOAD='"required_pull_request_reviews": null'
else
  # Detect if org/team or plain username
  if [[ "$REQUIRED_REVIEWER" == */* ]]; then
    REVIEWERS_PAYLOAD=$(cat <<EOF
"required_pull_request_reviews": {
  "dismiss_stale_reviews": true,
  "require_code_owner_reviews": true,
  "required_approving_review_count": 1,
  "bypass_pull_request_allowances": {}
}
EOF
)
  else
    REVIEWERS_PAYLOAD=$(cat <<EOF
"required_pull_request_reviews": {
  "dismiss_stale_reviews": true,
  "require_code_owner_reviews": true,
  "required_approving_review_count": 1,
  "bypass_pull_request_allowances": {}
}
EOF
)
  fi
fi

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${CI_CHECKS}
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF

echo "Branch protection applied successfully."
echo ""
echo "Rules configured:"
echo "  - CI checks required: lint, test, build"
echo "  - 1 approving review required (CODEOWNERS = CTO)"
echo "  - Stale reviews dismissed on new commits"
echo "  - Force pushes blocked"
echo "  - Branch deletion blocked"
echo "  - All conversations must be resolved"
