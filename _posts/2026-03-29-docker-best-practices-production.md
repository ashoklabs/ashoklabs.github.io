---
title: "Docker best practices often missed in production"
categories: [docker, devops, security]
date: 2026-03-29
image: https://i.imghippo.com/files/rZtq8756lrs.webp
description: The Dockerfile habits that quietly pay off — smaller images, fewer vulnerabilities, and containers that actually tell you when something is wrong.
---

# Docker best practices often missed in production

Most teams ship a Docker image that works and move on. Six months later they're staring at 40 CVEs and a 1.2 GB image that takes two minutes to pull. The shortcuts add up.

## Treat image size like it matters

A smaller image is faster to pull, but that's the least interesting part. Fewer packages means fewer things to patch. If your OWASP scan shows 20 vulnerabilities today, shipping less is the simplest way to have fewer tomorrow.

Runtime images and build environments should be separate things. What your container actually needs to run is usually much smaller than what it took to compile it. The mistake is treating these as the same.

## Combine RUN commands and clean up in the same step

Docker creates a new layer for every `RUN`, `COPY`, and `ADD` instruction. The problem isn't the layer count itself — cleanup commands in a separate `RUN` don't remove content from earlier layers. That content sticks around in image history.

The rule I follow: setup, install, and cleanup in one `RUN`. Less readable, but you stop shipping package manager caches to prod by accident.

```Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* /tmp/*
```

Run `docker history` on your current images. If you see multiple partial-cleanup layers, that's what to fix.

## Multi-stage builds should be the default

Compilers and package managers don't belong in your runtime container. Multi-stage builds are the cleanest way to enforce that.

```Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o /out/myapp ./...

FROM gcr.io/distroless/static
COPY --from=builder /out/myapp /usr/local/bin/myapp
USER 1002:1002
CMD ["/usr/local/bin/myapp"]
```

The final image has the binary and whatever it needs at runtime. No `go`, no `apk`, no cache. For Go services that's usually a 50–80 MB difference. Some languages are even more dramatic.

## Don't run as root

Try this sometime: take any exploit script, run it as root, then run it as a non-privileged app user. Same vulnerability, much less damage. The argument makes itself.

In local dev, `USER 1002:1002` is still worth setting. In stricter environments, unprivileged users add a real second layer before anything reaches the kernel.

```Dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser:appgroup
```

## Add a health check, or you're flying blind

A container in `Up` status can be completely stuck. If startup hangs at a DB migration, the orchestrator won't know — it'll keep routing traffic to a process that isn't ready.

```Dockerfile
HEALTHCHECK --interval=20s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

For Kubernetes, `livenessProbe` handles deadlock detection and `readinessProbe` handles traffic routing. For Docker Compose, `restart: on-failure`. Without any of this, you're chasing an issue in a container that looks healthy in your dashboard.

## Debug images should be separate images

Two categories worth knowing: sourceful and sourceless.

A sourceful image carries the build toolchain and maybe source files. You can exec in, poke around, check what's on the filesystem. That's useful when you're iterating in staging, less so when you consider that everything useful for debugging is also useful for an attacker.

A sourceless image has only what the process needs to run. Binary, runtime dependencies. Nothing else riding along.

Sourceful in staging is sometimes fine. In production I'd rather work from logs and traces. When you genuinely need a shell in prod, a debug image built from the same base gets you there without making it the default for every pod. The key is keeping it separate — build it, version it, pull it when you need it. Don't bake it in.

## Let CI enforce this, not your memory

A Dockerfile that's correct today can still cause problems if the base image shifts under you. At minimum, CI should run `docker build` with no cache in at least one job (failures that only surface on cold builds are real), run `grype` or `docker scan` and block on critical/high findings, and track image digests in deploy manifests instead of `latest`.

Digest pinning makes rollbacks mean something. Without it, "rolling back to the previous version" might pull an image built on a different base than what you tested.

## The stuff that's easy to skip

Pin base images to specific patched versions, not just `alpine:3`. Rebuild nightly or on base image updates — dependency drift shows up quietly, then all at once. And if you have an unusual `chmod` or `cksum` step, leave a comment explaining why it's there, not just what it does. The "what" is readable; the "why" is what you forget.

## When it all comes due

I've watched teams skip these things for months. Then a CVE lands, eight services need to be rebuilt at once, and a fix that takes 20 minutes during a quiet sprint turns into a two-day scramble.

If you can get your team to agree on just one of these — no root, or nothing extra in the runtime image — it already changes the picture. The other stuff is easier to fix when the foundation is clean.

---

If you found this useful, I write about Docker, platform engineering, and DevOps patterns regularly. Subscribe to the newsletter and get new posts straight to your inbox.

[Subscribe to the newsletter](https://ashoklabs.com/newsletter)
