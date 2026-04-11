---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-03-cgroups-namespaces/
title: "cgroups & Namespaces: What Makes a Container"
description: A container is not a VM. It's a Linux process with two kernel features switched on. Understanding cgroups and namespaces lets you debug container resource issues and understand security boundaries.
lesson_number: 3
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Linux, Containers, cgroups, Namespaces, Docker]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-02-signals-systemd/
prev_lesson_title: "Signals & systemd"
next_lesson: /courses/platform-engineering/lessons/s1-04-ip-subnets-routing/
next_lesson_title: "IP Addresses & Routing"
---

## Hook

A Kubernetes node is out of memory. The OOM killer fires and starts killing pods — but it kills the wrong ones. A low-priority batch job survives while your production API gets killed.

Why? Because resource limits weren't set. The OOM killer scored processes by memory usage and the API was using the most RAM.

Understanding **cgroups** is how you prevent this. Understanding **namespaces** is how you reason about container isolation and security.

---

## Core Concept: The Two Primitives Behind Containers

Containers have no special kernel support. They're Linux processes with two features applied:

- **cgroups** — limit what a process *can use* (CPU, memory, I/O)
- **namespaces** — control what a process *can see* (other processes, filesystem, network)

### cgroups — resource limits

A control group (cgroup) puts resource limits on a process or group of processes. When the limit is hit, the kernel enforces it:

- **Memory limit hit** → OOM killer kills the process
- **CPU limit hit** → process is throttled (slowed down, not killed)
- **I/O limit hit** → reads/writes are rate-limited

```bash
# Your shell's cgroup path
cat /proc/$$/cgroup
# Output: 0::/user.slice/user-1000.slice/session-1.scope

# A container's cgroup (run from the host after docker run)
CPID=$(docker inspect mycontainer --format '{{.State.Pid}}')
cat /proc/$CPID/cgroup

# Read the memory limit set on a container
# cgroup v1 path:
cat /sys/fs/cgroup/memory/docker/<container-id>/memory.limit_in_bytes

# Check current memory usage vs limit
cat /sys/fs/cgroup/memory/docker/<container-id>/memory.usage_in_bytes

# See resource usage per service (systemd cgroups)
systemd-cgtop
```

**Real-world example:** You set `resources.limits.memory: 512Mi` in a Kubernetes pod spec. Kubernetes translates this into a cgroup memory limit of 536870912 bytes on the node. When the container exceeds it, the kernel OOM-kills the container process. Kubernetes sees the exit code and marks the pod as `OOMKilled`.

### Namespaces — isolation boundaries

A namespace limits what a process can see. Each type isolates a different aspect of the system:

| Namespace | What it hides | Effect |
|-----------|--------------|--------|
| `pid` | Other processes | Container has its own PID 1; can't see host processes |
| `net` | Network interfaces & routes | Container has its own `eth0`, routing table, socket table |
| `mnt` | Filesystem mounts | Container sees only its own root filesystem |
| `uts` | Hostname | Container has its own hostname |
| `ipc` | Shared memory, semaphores | Container can't access host IPC resources |
| `user` | User/group IDs | UID 0 in container ≠ UID 0 on host (rootless containers) |

```bash
# List all namespaces on the host
lsns

# List namespaces for a specific process
lsns -p <pid>

# Enter a container's network namespace from the host
# (same as what docker exec does for network)
nsenter -t <container-pid> -n ip addr show

# Enter a container's PID namespace and see its process list
nsenter -t <container-pid> -p ps aux
```

### Why this matters for security

Namespaces provide **isolation, not security**. Key gaps:

- The kernel is shared — a kernel exploit affects all containers on the host
- `net` namespace isolation means containers can't see each other's traffic by default, but they're all on the same host network bridge
- A privileged container (`--privileged`) has all namespaces disabled — it's essentially running on bare metal

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>Never run containers with --privileged in production</strong>
    A privileged container can mount the host filesystem, load kernel modules, and modify host network interfaces. It's a full container escape waiting to happen. If a service asks for <code>--privileged</code>, push back hard and find an alternative.
  </div>
</div>

### The OOM killer — how it decides what to die

When memory is exhausted, the kernel scores every process with an `oom_score` (0–1000). Higher score = more likely to be killed. Score is based on:
- Memory usage (bigger = higher score)
- Process age (younger = higher score)
- Whether it's root-owned (small penalty)

```bash
# Check a process's OOM score
cat /proc/<pid>/oom_score

# Protect a critical process (score adjustment: -1000 to +1000)
# -1000 = never kill this process
echo -500 > /proc/<pid>/oom_score_adj

# Kubernetes sets oom_score_adj based on QoS class:
# Guaranteed pods: -998
# Burstable pods: varies
# BestEffort pods: 1000 (killed first)
```

---

## Quick Demo

```bash
# Create a container and find its process on the host
docker run -d --name demo --memory=64m nginx

# Find the container's PID on the host
CPID=$(docker inspect demo --format '{{.State.Pid}}')
echo "Container PID on host: $CPID"

# Verify it's a normal process
ps aux | grep $CPID

# Check its namespaces
lsns -p $CPID

# Read its memory limit from cgroup
MEM_LIMIT=$(cat /sys/fs/cgroup/memory/docker/$(docker inspect demo --format '{{.Id}}')/memory.limit_in_bytes 2>/dev/null || echo "cgroup v2 path")
echo "Memory limit: $MEM_LIMIT bytes"

# See the container thinks it's isolated
docker exec demo ps aux        # only sees its own processes
docker exec demo hostname      # its own hostname, not the host's
docker exec demo ip addr       # its own network interface

# Clean up
docker rm -f demo
```

**Expected output from `lsns -p $CPID`:**
```
        NS TYPE   NPROCS   PID COMMAND
4026531835 cgroup    120     1 systemd
4026533245 mnt         2  8432 nginx    ← container's own mount namespace
4026533246 uts         2  8432 nginx
4026533247 ipc         2  8432 nginx
4026533248 pid         2  8432 nginx    ← container's own PID namespace
4026533249 net         2  8432 nginx    ← container's own network namespace
```

---

## Recap + Action

**Key takeaway:** A container = Linux process + cgroups (resource limits) + namespaces (isolation). No magic, no VM. This mental model explains every container crash, OOM kill, and security boundary you'll encounter.

**Your action:** Start any Docker container and find its PID on the host:
```bash
docker run -d --name test nginx
docker inspect test --format '{{.State.Pid}}'
cat /proc/<that-pid>/status | head -5
```

Confirm that the process appears in the host's process table but has its own namespace.
