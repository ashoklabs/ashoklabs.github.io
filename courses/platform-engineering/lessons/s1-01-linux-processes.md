---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-01-linux-processes/
title: "How Linux Processes Work"
description: Every container, service, and crash you will ever debug traces back to one thing — a Linux process. Learn the fork/exec model, PID trees, and process states that platform engineers live in.
lesson_number: 1
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Linux, Processes, PID, Internals]

video_id: dQw4w9WgXcQ

prev_lesson:
prev_lesson_title:
next_lesson: /courses/platform-engineering/lessons/s1-02-signals-systemd/
next_lesson_title: "Signals & systemd"
---

## Hook

Your Kubernetes pod is stuck in `CrashLoopBackOff`. The container starts, then immediately exits. You exec in — it's already dead. Your logs say "killed."

Someone on the team says "must be a memory issue." But how do you confirm it? How do you see *what* actually happened and *why*?

The answer starts with understanding that a container is just a Linux process. And once you understand processes, the entire platform stack becomes readable.

---

## Core Concept: The Linux Process Model

### Everything is a process

Every program running on Linux — your web server, your database, your monitoring agent, your container — is a **process**. Processes are isolated units of execution. Each has:

- A unique **PID** (process ID)
- A **parent PID** (who created it)
- A **state** (running, sleeping, zombie, stopped)
- Allocated **memory** and open **file descriptors**

### The process tree

Processes form a tree rooted at **PID 1** — on modern systems, that's `systemd`. Every process has a parent. When your shell runs `ls`, it forks a child, that child execs `ls`, it exits.

```
systemd (PID 1)
├── sshd (PID 823)
│   └── bash (PID 1204)        ← your SSH session
│       └── curl (PID 1891)    ← command you just ran
├── nginx (PID 901)
└── postgres (PID 934)
```

### How processes are created: fork + exec

There are two system calls behind every new process:

**`fork()`** — makes an exact copy of the current process. The child inherits everything: memory, file descriptors, environment variables. Both parent and child continue from the same point.

**`exec()`** — replaces the current process's code with a new program. The PID stays the same; the program running inside it changes.

Your shell does `fork()` + `exec()` every time you run a command.

### Process states

| State | Symbol | What it means |
|-------|--------|---------------|
| Running | `R` | Using CPU right now |
| Sleeping (interruptible) | `S` | Waiting for I/O, can be woken by a signal |
| Sleeping (uninterruptible) | `D` | Waiting for I/O, **cannot** be woken — often a stuck disk or NFS |
| Zombie | `Z` | Finished but parent hasn't collected exit code yet |
| Stopped | `T` | Paused by a signal (e.g. `SIGSTOP`) |

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>D state is a red flag</strong>
    A process stuck in <code>D</code> (uninterruptible sleep) cannot be killed — not even with <code>kill -9</code>. It's waiting on a kernel operation, usually I/O. If you see many D-state processes, suspect a failing disk, NFS mount, or network filesystem.
  </div>
</div>

### Zombie processes

When a child exits, it stays in the process table as a **zombie** until the parent calls `wait()` to collect its exit code. Zombies hold no resources except a PID slot. Enough of them and you run out of PIDs — new processes can't start.

The fix is always in the parent: it must call `wait()`. In containers, if your app spawns child processes without handling `SIGCHLD`, zombies accumulate. That's why init systems like `tini` exist.

---

## Quick Demo

```bash
# See the full process tree with PIDs
pstree -p

# Show all processes with state column
ps aux
# STAT column: S=sleeping, R=running, Z=zombie, D=uninterruptible

# Find zombie processes specifically
ps aux | awk '$8 ~ /^Z/'

# Read everything about a specific process from /proc
cat /proc/$$/status        # $$ is your current shell's PID
# Key fields:
#   Name:     bash
#   State:    S (sleeping)
#   Pid:      1204
#   PPid:     823          ← parent PID
#   VmRSS:    4532 kB      ← resident memory
#   Threads:  1
```

**Expected output of `ps aux` (abbreviated):**
```
USER   PID  %CPU %MEM    VSZ   RSS  STAT  COMMAND
root     1   0.0  0.1 168940  9812  Ss    /sbin/init
root   823   0.0  0.0  72296  5940  Ss    sshd: /usr/sbin/sshd
user  1204   0.0  0.1  22252  8100  Ss    -bash
user  1891   0.0  0.0  14220  1024  R+    ps aux
```

```bash
# Walk the parent chain of any process
read_parent() {
  local pid=$1
  while [ "$pid" != "0" ]; do
    comm=$(cat /proc/$pid/comm 2>/dev/null)
    ppid=$(grep PPid /proc/$pid/status 2>/dev/null | awk '{print $2}')
    echo "PID $pid: $comm (parent: $ppid)"
    pid=$ppid
  done
}
read_parent $$
```

---

## Recap + Action

**Key takeaway:** A container is a Linux process. Understanding the PID tree, fork/exec, and process states is the foundation for debugging anything at the platform level.

**Your action:** SSH into any Linux machine and run:
```bash
pstree -p | head -20
cat /proc/$$/status | grep -E "^(Name|State|Pid|PPid|VmRSS)"
```

Identify the parent of your shell and trace it up to PID 1.
