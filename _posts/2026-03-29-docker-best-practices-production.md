---
title: "Docker best practices often missed in production"
categories: [docker, devops, security]
date: 2026-03-29
image: https://i.imghippo.com/files/ZJfw9444igg.webp
description: Avoid costly Docker mistakes in production. Learn image optimization, multi-stage builds, security hardening, and CI enforcement in one practical guide.
---

# Docker Production Best Practices Most Teams Skip — Until a CVE Forces Them

**Meta description:** Avoid costly Docker mistakes in production. Learn image optimization, multi-stage builds, security hardening, and CI enforcement in one practical guide.

**Primary keyword:** Docker production best practices
**Secondary keywords:** Docker image size, Docker security, multi-stage builds

---

## Introduction

Most teams ship a Docker image that works and move on. Six months later they're staring at 40 CVEs, a 1.2 GB image, and a two-minute pull time. Here's what makes that scenario avoidable: none of it requires starting over. A handful of Docker production best practices — applied consistently — changes the entire trajectory of your containers. This guide covers the ones that actually matter: image size, layer hygiene, multi-stage builds, security, health checks, and CI enforcement. If you implement even one, you'll be ahead of most production setups shipping today.

---

## Treat Image Size Like It Affects Your Security Posture (Because It Does)

A smaller image pulls faster. That's the least interesting part.

Fewer packages means fewer things to patch. If your OWASP scan shows 20 vulnerabilities today, shipping less is the simplest way to have fewer tomorrow. This is the argument for base image discipline that doesn't get made enough: size is a proxy for attack surface.

Runtime images and build environments should be separate things. What your container actually needs to run is usually much smaller than what it took to compile. The mistake is treating them as the same.

---

## Combine RUN Commands and Clean Up in the Same Layer

Docker creates a new layer for every `RUN`, `COPY`, and `ADD` instruction. The problem isn't the layer count — cleanup commands in a *separate* `RUN` don't remove content from earlier layers. That content sticks around in image history.

The rule: setup, install, and cleanup in one `RUN`. Less readable, but you stop shipping package manager caches to production by accident.

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* /tmp/*
```

Run `docker history` on your current images. If you see multiple partial-cleanup layers, that's what to fix first.

---

## Use Multi-Stage Builds — They Should Be Your Default

Compilers and package managers don't belong in your runtime container. Multi-stage builds are the cleanest way to enforce that separation.

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o /out/myapp ./...

FROM gcr.io/distroless/static
COPY --from=builder /out/myapp /usr/local/bin/myapp
USER 1002:1002
CMD ["/usr/local/bin/myapp"]
```

The final image has the binary and whatever it needs at runtime — no `go`, no `apk`, no cache. For Go services that's usually a 50–80 MB difference. Some languages are even more dramatic. This single change often cuts image size in half.

---

## Never Run Your Containers as Root

Take any exploit script. Run it as root, then run it as a non-privileged app user. Same vulnerability — much less damage. The argument makes itself.

In local dev, `USER 1002:1002` is still worth setting. In stricter environments, an unprivileged user adds a real second layer of protection before anything reaches the kernel.

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser:appgroup
```

This is the one practice that, if your team agrees on nothing else, immediately changes your security posture.

---

## Add a Health Check — or You're Routing Traffic to a Broken Container

A container in `Up` status can be completely stuck. If startup hangs at a DB migration, the orchestrator won't know — it'll keep routing traffic to a process that isn't ready.

```dockerfile
HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

For Kubernetes, `livenessProbe` handles deadlock detection and `readinessProbe` handles traffic routing. For Docker Compose, `restart: on-failure`. Without any of this, you're chasing an issue inside a container that looks perfectly healthy on your dashboard.

---

## Keep Debug Images Separate From Production Images

Two categories worth knowing: sourceful and sourceless.

A **sourceful** image carries the build toolchain and possibly source files. You can exec in, poke around, and check the filesystem — useful when iterating in staging, but everything useful for debugging is also useful for an attacker.

A **sourceless** image has only what the process needs to run: binary, runtime dependencies, nothing else.

Sourceful in staging is sometimes fine. In production, build from logs and traces. When you genuinely need a shell in prod, pull a debug image built from the same base — don't bake it in by default. Build it, version it, pull it when you need it.

---

## Let CI Enforce This, Not Your Memory

A Dockerfile that's correct today can still cause problems if the base image shifts under you. At minimum, your CI pipeline should:

- Run `docker build` with `--no-cache` in at least one job (cold-build failures are real and silent otherwise)
- Run `grype` or `docker scan` and block on critical/high findings
- Track image digests in deploy manifests instead of `latest`

Digest pinning makes rollbacks mean something. Without it, "rolling back to the previous version" might pull an image built on a different base than what you tested.

---

## The Small Things That Compound Over Time

Pin base images to specific patched versions — not just `alpine:3`. Rebuild nightly or on base image updates; dependency drift shows up quietly, then all at once. And if you have an unusual `chmod` or `cksum` step, leave a comment explaining *why* it's there, not just what it does. The "what" is readable; the "why" is what you forget six months later.

---

## Conclusion

These aren't theoretical hardening tips — they're the practices that separate a container that works from one that's defensible six months later. I've watched teams skip them for months. Then a CVE lands, eight services need to be rebuilt at once, and a fix that takes 20 minutes during a quiet sprint turns into a two-day scramble.

Start with one: no root, or nothing extra in the runtime image. It already changes the picture. The rest becomes easier once the foundation is clean.

---

**If this was useful**, I write about Docker, platform engineering, and DevOps patterns regularly. Subscribe below and get new posts straight to your inbox — no spam, unsubscribe anytime.

**[Subscribe to the newsletter →](https://ashoklabs.com/newsletter)**
