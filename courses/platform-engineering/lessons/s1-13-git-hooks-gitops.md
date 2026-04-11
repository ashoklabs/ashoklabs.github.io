---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-13-git-hooks-gitops/
title: "Git Hooks & GitOps"
description: Someone pushed a hardcoded AWS key to GitHub. A bot found it in 4 seconds. A pre-commit hook would have caught it first. Learn how hooks enforce standards automatically — and how GitOps makes Git the only way to change production.
lesson_number: 13
duration: 10 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Git, Hooks, GitOps, ArgoCD, CI/CD]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-12-advanced-git/
prev_lesson_title: "Advanced Git Commands"
next_lesson: /courses/platform-engineering/lessons/02-application-platform/
next_lesson_title: Application Platform
---

## Hook

3:47 AM. GitHub sends an automated security alert: *"A secret was detected in a public repository."*

An engineer committed an AWS access key to a public repo 4 seconds ago. An automated scanner found it. The key was already rotated by the time they woke up — but the incident was logged.

A `pre-commit` hook scanning for secrets would have blocked the commit before it ever reached the remote. That hook takes 10 minutes to set up and runs in milliseconds.

---

## Core Concept: Git Hooks

Git hooks are shell scripts that run automatically at specific points in the Git workflow. They live in `.git/hooks/` and are triggered by Git commands.

### The hooks platform teams use most

| Hook | When it runs | Blocks the action? | Common use |
|------|-----------|--------------------|-----------|
| `pre-commit` | Before creating the commit | Yes — exit non-zero | Linting, secret scanning, test running |
| `commit-msg` | After writing message, before commit | Yes | Enforce commit message format |
| `pre-push` | Before pushing to remote | Yes | Prevent pushing to protected branches |
| `post-commit` | After commit is created | No | Notifications, local logging |

### pre-commit hook — catching problems early

```bash
#!/bin/bash
# .git/hooks/pre-commit
set -e

# 1. Scan for secrets
echo "Checking for secrets..."
git diff --cached --name-only | while read file; do
  if grep -qE "(AWS_SECRET|password\s*=\s*['\"][^'\"]+['\"]|api_key\s*=)" "$file" 2>/dev/null; then
    echo "ERROR: Possible secret in $file"
    exit 1
  fi
done

# 2. Run linter on staged files
echo "Running linter..."
git diff --cached --name-only --diff-filter=ACMR | grep '\.go$' | xargs -r golangci-lint run

echo "Pre-commit checks passed."
```

### commit-msg hook — enforcing Conventional Commits

Conventional Commits give you structured, machine-readable history. Format: `type(scope): description`

```bash
#!/bin/bash
# .git/hooks/commit-msg
COMMIT_MSG=$(cat "$1")
PATTERN="^(feat|fix|chore|docs|refactor|test|ci|perf|build)(\(.+\))?: .{3,}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo ""
  echo "ERROR: Invalid commit message format."
  echo "Required: type(scope): description"
  echo "Examples:"
  echo "  feat(auth): add OAuth2 login"
  echo "  fix(payments): handle Stripe webhook retry"
  echo "  chore: update dependencies"
  echo ""
  exit 1
fi
```

### Using the pre-commit framework (recommended)

Managing hooks across a team is painful — `.git/hooks/` isn't committed to the repo. The `pre-commit` framework solves this by versioning hooks in `.pre-commit-config.yaml`.

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: detect-private-key     # ← catches AWS keys, PEM files

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks               # ← comprehensive secret scanning
```

```bash
pip install pre-commit
pre-commit install          # installs hooks into .git/hooks/
pre-commit run --all-files  # run manually on everything
```

---

## Core Concept: GitOps

GitOps applies the Git workflow to infrastructure and deployment. The Git repository is the **single source of truth** for what should be running in production.

### The core idea

Instead of your CI pipeline *pushing* changes to the cluster:

```
# Traditional CI/CD:
Engineer → PR merge → CI builds image → CI runs kubectl apply → Cluster changes
```

A GitOps operator *pulls* changes from Git:

```
# GitOps:
Engineer → PR merge → Git state changes → Operator detects diff → Cluster reconciles
```

### Four GitOps principles

1. **Declarative** — describe the desired state in files (Kubernetes YAML, Terraform)
2. **Versioned** — all state in Git — every change has a commit, a PR, an author
3. **Automated** — approved changes automatically apply to the system
4. **Reconciled** — an operator continuously compares desired (Git) vs actual (cluster) state and corrects drift

### ArgoCD — GitOps for Kubernetes

```bash
# Create an ArgoCD application pointing at a Git repo
argocd app create myapp \
  --repo https://github.com/myorg/k8s-config.git \
  --path production/myapp \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace production \
  --sync-policy automated \
  --auto-prune \     # delete resources removed from Git
  --self-heal        # revert manual changes to match Git
```

**`--self-heal`** is the key GitOps enforcement: if someone runs `kubectl edit` or `kubectl scale` directly in production, ArgoCD reverts it within 3 minutes to match the Git state. The only valid way to change production is to merge a PR.

**`--auto-prune`** ensures that removing a resource from Git actually removes it from the cluster — no orphaned deployments lingering after a service is decommissioned.

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>The GitOps audit trail</strong>
    In a GitOps setup, every production change is a Git commit with an author, a PR reviewer, and a timestamp. This makes compliance and postmortems easy — "what changed in production between 2pm and 3pm?" becomes a <code>git log</code> query.
  </div>
</div>

---

## Quick Demo

```bash
# Set up a commit-msg hook in any repo
cd your-repo

cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash
MSG=$(cat "$1")
if ! echo "$MSG" | grep -qE "^(feat|fix|chore|docs|refactor|test|ci)(\(.+\))?: .{3,}"; then
  echo "Invalid commit message. Use: type(scope): description"
  echo "Example: feat(api): add rate limiting"
  exit 1
fi
EOF
chmod +x .git/hooks/commit-msg

# Test it
git commit --allow-empty -m "bad message"
# Expected: "Invalid commit message. Use: type(scope): description"

git commit --allow-empty -m "feat(api): add rate limiting"
# Expected: commit succeeds

# Set up pre-commit framework
pip install pre-commit
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: detect-private-key
      - id: check-yaml
      - id: end-of-file-fixer
EOF
pre-commit install
pre-commit run --all-files
```

---

## Recap + Action

**Key takeaway:** Git hooks enforce standards automatically — no PR review can catch what a pre-commit hook catches at the source. GitOps makes Git the only valid way to change production, giving you a complete audit trail and instant rollback via `git revert`.

**Your action:** Add a `commit-msg` hook to any repo you're actively working in:
```bash
cat > .git/hooks/commit-msg << 'EOF'
#!/bin/bash
MSG=$(cat "$1")
echo "$MSG" | grep -qE "^(feat|fix|chore|docs|refactor|test|ci)(\(.+\))?: .{3,}" && exit 0
echo "Use Conventional Commits: type(scope): description" && exit 1
EOF
chmod +x .git/hooks/commit-msg
```

Try committing with a bad message and confirm it blocks. Then fix the message and commit successfully.
