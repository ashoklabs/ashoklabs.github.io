---
layout: lesson
permalink: /courses/platform-engineering/lessons/03-containerisation/
title: Containerisation
description: Package applications into portable, reproducible containers using Docker — from image fundamentals to multi-stage builds, layer caching, and security hardening.
lesson_number: 3
duration: 50 min
section_number: 2
section_title: "Build & Ship"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Docker, Containers, Security]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/02-application-platform/
prev_lesson_title: "Application Platform"
next_lesson: /courses/platform-engineering/lessons/04-cicd-engineering/
next_lesson_title: "CI/CD Engineering"
---

## What You Will Learn

- Understand container internals: namespaces, cgroups, and the OCI image spec
- Write production-quality Dockerfiles with multi-stage builds
- Optimise image size and layer caching for fast CI pipelines
- Scan images for vulnerabilities and harden container security
- Push and manage images in a container registry

---

## 1. How Containers Work

Containers are not VMs. They are isolated processes sharing the host kernel, implemented using two Linux primitives:

### Namespaces — isolation

| Namespace  | What it isolates                     |
|------------|--------------------------------------|
| `pid`      | Process IDs — container sees PID 1   |
| `net`      | Network interfaces and routing       |
| `mnt`      | Filesystem mount points              |
| `uts`      | Hostname and domain name             |
| `ipc`      | IPC resources (shared memory, queues)|
| `user`     | UID/GID mappings (rootless mode)     |

### cgroups — resource limits

```bash
# Limit container to 512 MB RAM and 1 CPU
docker run --memory 512m --cpus 1 my-app:v1
```

<div class="callout callout--info">
  <span class="callout-icon">📌</span>
  <div class="callout-body">
    <strong>Key insight</strong>
    When Kubernetes sets <code>resources.limits</code> in a Pod spec, it translates directly to cgroup limits on the host. Understanding this connection helps you debug OOMKilled pods.
  </div>
</div>

---

## 2. Writing Production Dockerfiles

### The naive approach (don't do this)

```dockerfile
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nodejs npm
COPY . /app
WORKDIR /app
RUN npm install
CMD ["node", "server.js"]
```

Problems: 800+ MB image, npm devDependencies included, runs as root.

### Multi-stage build (do this instead)

```dockerfile
# ── Stage 1: build ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production   # only prod deps, no devDeps

COPY . .
RUN npm run build

# ── Stage 2: runtime ─────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only built artefacts from stage 1
COPY --from=build --chown=appuser:appgroup /app/dist ./dist
COPY --from=build --chown=appuser:appgroup /app/node_modules ./node_modules

USER appuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Result: ~120 MB image, non-root user, no build tools in production.

---

## 3. Layer Caching — Speed Up Your CI

Docker caches each layer. Layers only rebuild when their content changes or a layer above them changes.

```dockerfile
# BAD — code changes bust the npm install cache
COPY . .
RUN npm ci

# GOOD — package files rarely change; code changes don't bust install cache
COPY package*.json ./
RUN npm ci
COPY . .
```

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>Cache ordering rule</strong>
    Always copy dependency manifests (<code>package.json</code>, <code>go.mod</code>, <code>requirements.txt</code>) before copying application source. Dependency installs are expensive; source copies are cheap.
  </div>
</div>

---

## 4. Security Hardening

### Image scanning

```bash
# Scan with Trivy (open source, used in most CI pipelines)
trivy image my-app:v1.2.0

# Fail CI if HIGH or CRITICAL vulns found
trivy image --exit-code 1 --severity HIGH,CRITICAL my-app:v1.2.0
```

### Minimal base images

| Base image        | Size   | Use when                          |
|-------------------|--------|-----------------------------------|
| `alpine`          | ~5 MB  | Shells, CLIs, minimal runtimes    |
| `distroless`      | ~2 MB  | Production Go/Java/Python apps    |
| `scratch`         | 0 MB   | Statically compiled Go binaries   |
| `ubuntu:22.04`    | ~70 MB | When you need package manager     |

### Non-root is non-negotiable

```dockerfile
# Always run as a non-root user
RUN useradd -r -u 1001 appuser
USER 1001
```

Kubernetes admission controllers (like OPA Gatekeeper) will **reject** pods running as UID 0 in most production environments.

---

## 5. Hands-on Exercise

1. Take an existing application Dockerfile and rewrite it as a multi-stage build
2. Measure the image size before and after: `docker images | grep my-app`
3. Run `trivy image` on the original and new images — compare the vulnerability count
4. Add a `.dockerignore` file to exclude `node_modules`, `.git`, and test files
5. Push your optimised image to GitHub Container Registry (GHCR)

---

## Summary

| Concept          | Key takeaway                                                    |
|------------------|-----------------------------------------------------------------|
| Namespaces       | Process isolation without a separate kernel                     |
| cgroups          | CPU and memory limits enforced by the host kernel               |
| Multi-stage builds | Build artefacts stay out of production images                 |
| Layer caching    | Order COPY statements from least to most frequently changing    |
| Non-root         | Always define a non-root USER — most prod clusters require it   |
