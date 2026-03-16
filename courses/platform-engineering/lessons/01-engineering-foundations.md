---
layout: lesson
permalink: /courses/platform-engineering/lessons/01-engineering-foundations/
title: Engineering Foundations
description: Build the mental model every platform engineer needs — Linux internals, networking fundamentals, DNS resolution, HTTP, and production-grade Git workflows.
lesson_number: 1
duration: 45 min
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Linux, Networking, Git]

# Replace with your actual YouTube unlisted video ID
video_id: dQw4w9WgXcQ

prev_lesson:
prev_lesson_title:
next_lesson: /courses/platform-engineering/lessons/02-application-platform/
next_lesson_title: Application Platform
---

## What You Will Learn

By the end of this lesson you will be able to:

- Navigate the Linux filesystem and understand process management
- Explain how DNS resolution works end-to-end
- Describe the HTTP/1.1 and HTTP/2 request lifecycle
- Structure a production Git workflow with branching strategies
- Diagnose basic network connectivity issues using standard CLI tools

---

## 1. Linux Internals for Platform Engineers

The Linux kernel is the foundation of every platform you will operate. Understanding it at the right depth — not too shallow, not too deep — is what separates platform engineers from ops generalists.

### The process hierarchy

Every running program is a process. Processes form a tree rooted at PID 1 (typically `systemd` or `init`). Platform engineers interact with this tree constantly:

```bash
# See the full process tree
pstree -p

# Find what is listening on port 8080
ss -tlnp | grep 8080

# Inspect a specific process
cat /proc/<pid>/status
```

### Filesystem hierarchy

| Path        | Purpose                                      |
|-------------|----------------------------------------------|
| `/etc`      | System-wide configuration files              |
| `/var/log`  | Log files — your first stop in an incident   |
| `/proc`     | Virtual filesystem exposing kernel state     |
| `/sys`      | Hardware and driver configuration            |
| `/tmp`      | Ephemeral storage — cleared on reboot        |
| `/opt`      | Third-party software installations           |

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>Platform engineer habit</strong>
    Always check <code>/var/log/syslog</code> and <code>journalctl -xe</code> before assuming a binary issue. 80% of incidents are configuration or resource problems visible in logs.
  </div>
</div>

---

## 2. Networking Fundamentals

### How DNS resolution works

When your application calls `api.example.com`, here is what happens:

1. **Local cache** — OS checks `/etc/hosts`, then the local DNS cache
2. **Recursive resolver** — Usually your ISP or `8.8.8.8` — queries the chain
3. **Root nameserver** — Knows which TLD server handles `.com`
4. **TLD nameserver** — Knows which authoritative server handles `example.com`
5. **Authoritative nameserver** — Returns the actual IP address
6. **TTL** — The result is cached for `TTL` seconds

```bash
# Full DNS resolution trace
dig +trace api.example.com

# Check what nameserver your machine uses
cat /etc/resolv.conf

# Query a specific nameserver
dig @8.8.8.8 api.example.com
```

### TCP connection lifecycle

```
Client                    Server
  |                          |
  |------ SYN ------------>  |   (1) Client initiates
  |  <--- SYN-ACK ---------  |   (2) Server acknowledges
  |------ ACK ------------>  |   (3) Connection established
  |                          |
  |<===== DATA FLOWS ======> |
  |                          |
  |------ FIN ------------>  |   (4) Client closes
  |  <--- FIN-ACK ---------  |   (5) Server closes
```

### HTTP/2 vs HTTP/1.1

| Feature          | HTTP/1.1       | HTTP/2              |
|------------------|----------------|---------------------|
| Multiplexing     | No (one req/conn) | Yes (multiple req/conn) |
| Header compression | No          | Yes (HPACK)         |
| Server push      | No             | Yes                 |
| Binary framing   | No (text)      | Yes                 |

---

## 3. Git Workflows for Platform Teams

Platform teams often manage hundreds of repositories. A consistent Git workflow prevents chaos.

### Trunk-based development (recommended for platforms)

```
main (always deployable)
  │
  ├── feat/add-terraform-module   (short-lived, < 2 days)
  ├── fix/k8s-oom-killer          (short-lived)
  └── chore/update-dependencies   (short-lived)
```

### Essential Git commands for platform engineers

```bash
# Inspect the reflog to recover from mistakes
git reflog

# Rewrite the last 3 commits interactively (before pushing)
git rebase -i HEAD~3

# Find which commit introduced a bug
git bisect start
git bisect bad HEAD
git bisect good v1.2.0
# git checks out commits — you test each one
git bisect reset

# Cherry-pick a hotfix to a release branch
git checkout release/v2.1
git cherry-pick abc123
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>Never force-push to main</strong>
    Protect your main branch with branch protection rules in GitHub. Require PR reviews and passing CI before merging.
  </div>
</div>

---

## 4. Hands-on Exercise

Set up a local Linux environment and complete the following:

1. Use `ss` to list all listening TCP ports on your machine
2. Run `dig +trace` on your own domain and draw the resolution chain
3. Create a Git repository, make 3 commits, then interactively rebase them into 1
4. Set up a `pre-commit` hook that runs a linter before every commit

---

## Summary

| Concept         | Key takeaway                                               |
|-----------------|------------------------------------------------------------|
| Linux processes | Everything is a process; PID 1 is the parent of all       |
| DNS             | Hierarchical resolution with caching at each layer        |
| TCP             | Three-way handshake before any data flows                 |
| HTTP/2          | Single connection, multiplexed streams, binary framing    |
| Git             | Short-lived branches, trunk-based development, clean history |
