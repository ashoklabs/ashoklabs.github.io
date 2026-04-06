---
title: "GitHub Actions CI/CD Tutorial — Build a Real Pipeline From Scratch"
categories: [devops, cicd]
date: 2026-04-16
image: https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&q=80
description: A hands-on GitHub Actions tutorial that builds a complete CI/CD pipeline — tests, Docker build, security scan, and deployment — from zero to production-ready.
---

# GitHub Actions CI/CD Tutorial — Build a Real Pipeline From Scratch

**Primary keyword:** GitHub Actions CI/CD tutorial
**Secondary keywords:** GitHub Actions tutorial beginners, build CI/CD pipeline GitHub, GitHub Actions Docker deploy

---

## Introduction

GitHub Actions is the most accessible CI/CD platform available in 2026. It's tightly integrated with GitHub, runs in hosted environments with no infrastructure to maintain, and has a marketplace of thousands of pre-built actions. More importantly, it's widely used in production — knowing it well is a genuine job skill. This tutorial builds a complete, production-grade CI/CD pipeline from scratch: running tests, building and scanning a Docker image, and deploying to a Kubernetes cluster. By the end, you'll have a working pipeline you can adapt for real projects.

---

## How GitHub Actions Works

GitHub Actions runs **workflows** — defined in YAML files in `.github/workflows/`. A workflow is triggered by an **event** (push, pull request, schedule) and runs one or more **jobs**, each consisting of a series of **steps**.

```
Event (push to main)
  └── Workflow (.github/workflows/deploy.yml)
        └── Job 1: test
              ├── Step: checkout code
              ├── Step: run tests
        └── Job 2: build (depends on test)
              ├── Step: build Docker image
              ├── Step: push to registry
        └── Job 3: deploy (depends on build)
              ├── Step: deploy to Kubernetes
```

Jobs run in parallel by default. Use `needs:` to create dependencies between them.

---

## Step 1: Your First Workflow — Run Tests on Every Pull Request

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run tests
        run: pytest tests/ -v --tb=short

      - name: Run linting
        run: |
          pip install flake8
          flake8 . --max-line-length=100
```

Push this to your repository and open a pull request. GitHub will automatically run the workflow and show a green or red check on the PR. A failed test blocks the merge — that's CI working as intended.

**Key concepts here:**
- `on:` defines triggers. This runs on PRs to `main` and pushes to `main`.
- `runs-on: ubuntu-latest` selects the hosted runner environment.
- `uses:` pulls a pre-built action from the marketplace.
- `with:` passes inputs to that action.
- `cache: 'pip'` caches pip dependencies between runs — speeds things up significantly.

---

## Step 2: Build and Push a Docker Image

Extend the workflow with a `build` job that runs after tests pass:

```yaml
  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=sha,prefix=,suffix=,format=short

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**What's happening here:**
- `needs: test` ensures this job only runs if tests pass.
- `outputs:` exposes the built image tag to downstream jobs.
- `secrets.GITHUB_TOKEN` is automatically provided by GitHub — no manual secret setup needed for GHCR.
- `type=sha` tags the image with the git commit SHA — ensures every image is uniquely identified.
- `cache-from/cache-to: type=gha` uses GitHub Actions cache for Docker layer caching — dramatically speeds up rebuilds.
- `push: ${{ github.event_name != 'pull_request' }}` — only push the image on merges to main, not on PRs.

---

## Step 3: Add Security Scanning — Block on Critical CVEs

Add a scan step before pushing:

```yaml
      - name: Scan image for vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

`exit-code: '1'` means the workflow fails if critical or high CVEs are found. This prevents vulnerable images from ever reaching your registry.

---

## Step 4: Deploy to Kubernetes

Add a deploy job that runs only on merges to main, with a manual approval gate for production:

```yaml
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBECONFIG_STAGING }}" | base64 -d > kubeconfig.yaml
          echo "KUBECONFIG=$PWD/kubeconfig.yaml" >> $GITHUB_ENV

      - name: Deploy to staging
        run: |
          kubectl set image deployment/myapp \
            myapp=ghcr.io/${{ github.repository }}:${{ github.sha }} \
            --namespace=staging
          kubectl rollout status deployment/myapp --namespace=staging --timeout=120s

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.example.com

    steps:
      - name: Deploy to production
        run: |
          kubectl set image deployment/myapp \
            myapp=ghcr.io/${{ github.repository }}:${{ github.sha }} \
            --namespace=production
          kubectl rollout status deployment/myapp --namespace=production --timeout=120s
```

**Key details:**
- `environment: production` triggers a manual approval gate if you've configured required reviewers in GitHub's Environment settings. No one gets to production without a human approval.
- `kubectl rollout status --timeout=120s` makes the pipeline fail if the deployment doesn't become healthy within 2 minutes — automatic detection of bad deploys.
- Store your `KUBECONFIG` as a base64-encoded secret in GitHub repository settings.

---

## Step 5: Secrets and Environment Variables

Never hardcode secrets. GitHub provides two ways to manage them:

**Repository secrets** — go to Settings → Secrets and variables → Actions. Reference them as `${{ secrets.MY_SECRET }}`. Secrets are never logged or exposed in UI.

**Environment secrets** — scoped to a specific environment (staging, production). More secure for sensitive credentials.

```yaml
- name: Configure database
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    DB_HOST: ${{ vars.DB_HOST }}  # non-sensitive config can use vars, not secrets
  run: ./configure-db.sh
```

---

## Step 6: Scheduled Jobs and Drift Detection

GitHub Actions also runs on a schedule — useful for nightly builds, security scans, or infrastructure drift detection:

```yaml
name: Nightly Security Scan

on:
  schedule:
    - cron: '0 2 * * *'  # 2am UTC daily

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Scan production image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}:latest
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: trivy-results.sarif

      - name: Upload scan results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-results.sarif
```

This uploads vulnerability scan results directly to GitHub's Security tab — visible without leaving GitHub.

---

## The Complete Pipeline at a Glance

```
PR opened
  → test job runs (lint + unit tests)
  → build job runs (Docker build, security scan) — image NOT pushed
  → PR shows green/red check

PR merged to main
  → test job runs
  → build job runs — image built, scanned, pushed to GHCR with SHA tag
  → deploy-staging runs automatically
  → deploy-production waits for manual approval
  → approved → production deployment with rollout health check
```

---

## Conclusion

A well-built GitHub Actions pipeline is a force multiplier for your team. Tests run automatically on every change. Vulnerable images never reach production. Staging is always ahead of production by at least one review cycle. Deployments are automatic but gated by human approval. This pipeline pattern covers the fundamentals of production CI/CD — adapt it to your stack and your team's requirements.

---

**Want to build this pipeline as part of a hands-on DevOps curriculum with lab environments?** Everything is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
