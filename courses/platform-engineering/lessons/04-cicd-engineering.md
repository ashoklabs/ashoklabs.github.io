---
layout: lesson
permalink: /courses/platform-engineering/lessons/04-cicd-engineering/
title: CI/CD Engineering
description: Design and build reliable delivery pipelines with GitHub Actions — from first commit to production deploy, with automated testing, security gates, and artifact management.
lesson_number: 4
duration: 55 min
section_number: 2
section_title: "Build & Ship"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [GitHub Actions, CI/CD, Pipelines]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/03-containerisation/
prev_lesson_title: "Containerisation"
next_lesson: /courses/platform-engineering/lessons/05-infrastructure-as-code/
next_lesson_title: "Infrastructure as Code"
---

## What You Will Learn

- Design a complete CI/CD pipeline from scratch using GitHub Actions
- Implement testing, security scanning, and quality gates
- Build and push Docker images to a container registry
- Manage secrets and environment promotion safely
- Understand deployment strategies: rolling, blue/green, canary

---

## 1. Pipeline Design Principles

A good CI/CD pipeline is **fast, reliable, and safe**.

```
Developer pushes code
        │
        ▼
  ┌─────────────┐
  │   CI Stage  │  < 5 minutes
  │  lint + test│
  │  build image│
  │  scan image │
  └──────┬──────┘
         │ passes
         ▼
  ┌─────────────┐
  │  CD: Staging│  automatic
  │  deploy     │
  │  smoke test │
  └──────┬──────┘
         │ passes
         ▼
  ┌─────────────┐
  │ CD: Prod    │  manual approval
  │  deploy     │  or auto on tag
  └─────────────┘
```

### The "shift left" principle

Move quality checks as early as possible. A linter failure at second 15 is better than a test failure at minute 8.

---

## 2. GitHub Actions Pipeline

### Complete workflow example

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, 'release/**']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ── Stage 1: Quality ──────────────────────────────────────────
  quality:
    name: Lint & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  # ── Stage 2: Build & Scan ─────────────────────────────────────
  build:
    name: Build & Push Image
    needs: quality
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    outputs:
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=,suffix=,format=short
            type=ref,event=branch
            type=semver,pattern={{version}}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan image for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          exit-code: '1'
          severity: 'HIGH,CRITICAL'

  # ── Stage 3: Deploy to Staging ────────────────────────────────
  deploy-staging:
    name: Deploy → Staging
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          echo "Deploying ${{ needs.build.outputs.image-digest }} to staging"
          # kubectl set image deployment/app app=$IMAGE:$SHA
```

---

## 3. Secrets Management

**Never hardcode secrets.** GitHub Actions has three layers:

| Level            | Scope                             | Use for                      |
|------------------|-----------------------------------|------------------------------|
| Repository       | Single repo                       | Repo-specific API keys       |
| Environment      | Specific environments (prod/stg)  | Production credentials       |
| Organisation     | All repos in org                  | Shared infra credentials     |

```yaml
steps:
  - name: Deploy
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_KEY: ${{ secrets.API_KEY }}
    run: ./deploy.sh
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>Never echo secrets</strong>
    GitHub masks known secrets in logs, but avoid <code>echo $SECRET</code> — encoding tricks can bypass masking. Pass secrets as env vars to commands, never as CLI arguments.
  </div>
</div>

---

## 4. Deployment Strategies

### Rolling deployment (default in Kubernetes)

```
v1 v1 v1 v1    →    v2 v1 v1 v1    →    v2 v2 v1 v1    →    v2 v2 v2 v2
```

- Zero-downtime if configured correctly (`maxSurge`, `maxUnavailable`)
- Simple to implement and roll back

### Blue/Green deployment

```
Traffic: 100% → Blue (v1)

Deploy Green (v2), run smoke tests
Traffic: 100% → Green (v2)   (instant cutover)

Keep Blue running for fast rollback
```

### Canary deployment

```
Traffic: 95% → Stable (v1)
         5% → Canary (v2)    ← monitor error rate and latency

Gradually increase: 5% → 20% → 50% → 100%
Abort if metrics degrade
```

---

## 5. Hands-on Exercise

1. Create a `.github/workflows/ci.yml` for an existing project with lint + test jobs
2. Add a Docker build step that pushes to GHCR on merge to `main`
3. Add Trivy image scanning with a HIGH/CRITICAL failure gate
4. Add a staging deployment job that runs automatically on `main`
5. Add a production deployment job that requires manual approval

---

## Summary

| Concept            | Key takeaway                                                      |
|--------------------|-------------------------------------------------------------------|
| Pipeline stages    | Quality → Build → Staging → Production — each stage gates the next |
| Shift left         | Run cheap checks first; fail fast on quality issues               |
| Secrets management | Use GitHub Environments for scoped production credentials         |
| Rolling            | Default K8s strategy — gradual replacement with rollback support  |
| Canary             | Route a small percentage of traffic first — safest for production |
