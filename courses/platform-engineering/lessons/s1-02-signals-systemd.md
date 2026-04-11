---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-02-signals-systemd/
title: "Signals & systemd"
description: Why does docker stop take 30 seconds? Because your app is ignoring SIGTERM. Learn how signals work and how systemd uses them to manage services in production.
lesson_number: 2
duration: 10 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Linux, Signals, systemd, Services]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-01-linux-processes/
prev_lesson_title: "How Linux Processes Work"
next_lesson: /courses/platform-engineering/lessons/s1-03-cgroups-namespaces/
next_lesson_title: "cgroups & Namespaces"
---

## Hook

You run `docker stop mycontainer`. It hangs for 30 seconds, then the container gets force-killed. Your app logs show no clean shutdown — in-flight requests were dropped, database connections went stale.

The problem: your application is ignoring `SIGTERM`. Docker sends SIGTERM, waits 30 seconds, then sends `SIGKILL`. If your app doesn't handle SIGTERM, you will always have dirty shutdowns.

This is a signal problem. And it's one of the most common issues in production containerised environments.

---

## Core Concept: Signals

Signals are asynchronous notifications the kernel sends to processes. They're how the OS and other processes communicate control events — "stop", "reload", "die".

### The signals platform engineers use daily

| Signal | Number | Can be caught? | Meaning |
|--------|--------|---------------|---------|
| `SIGTERM` | 15 | Yes | "Please shut down gracefully" |
| `SIGKILL` | 9 | **No** | "Die immediately — no cleanup" |
| `SIGHUP` | 1 | Yes | "Reload your config" (by convention) |
| `SIGINT` | 2 | Yes | Ctrl+C — interrupt from terminal |
| `SIGCHLD` | 17 | Yes | A child process exited |

**The right order when stopping a service:**
1. Send `SIGTERM` — give the app a chance to close connections and flush buffers
2. Wait up to 30 seconds
3. If still running, send `SIGKILL`

Never reach for `kill -9` first. It bypasses all cleanup code.

### What your app must do with SIGTERM

A production application should:
1. Stop accepting new requests
2. Finish in-flight requests (up to a timeout)
3. Close database connections cleanly
4. Flush logs and metrics
5. Exit with code 0

```python
# Python example — graceful shutdown on SIGTERM
import signal
import sys

def handle_sigterm(sig, frame):
    print("SIGTERM received — shutting down gracefully")
    server.stop(grace=30)   # 30 second grace period
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
```

### systemd — PID 1 for services

systemd is the init system on virtually every modern Linux distro. It manages the lifecycle of services: starts them on boot, restarts them on failure, captures their logs.

**The mental model:** systemd is to services what a process supervisor is to child processes. It owns PID 1 and parents all other services.

```bash
# The four commands you use every day
systemctl status nginx          # is it running? recent logs?
systemctl restart nginx         # stop + start
systemctl reload nginx          # send SIGHUP (reload config without restart)
journalctl -fu nginx            # follow logs in real time

# When a service fails to start
systemctl status nginx          # shows last 10 lines of output
journalctl -u nginx -n 50       # last 50 log lines
journalctl -u nginx --since "5 min ago"
```

### A minimal systemd unit file

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My API Service
After=network.target

[Service]
ExecStart=/opt/myapp/bin/api --port 8080
Restart=on-failure      # restart if the process exits non-zero
RestartSec=5s           # wait 5s before restarting
TimeoutStopSec=30s      # give it 30s to handle SIGTERM before SIGKILL
StandardOutput=journal  # logs go to journald (use journalctl to read)
StandardError=journal

[Install]
WantedBy=multi-user.target
```

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>Always daemon-reload after editing unit files</strong>
    systemd reads unit files into memory at startup. If you edit a <code>.service</code> file, run <code>systemctl daemon-reload</code> before restarting — otherwise your changes are silently ignored.
  </div>
</div>

### Common mistake: Restart=always vs Restart=on-failure

`Restart=always` sounds safer but it restarts even on clean exits (exit code 0). If your app crashes on startup due to a config error, it will restart in a tight loop and thrash the CPU. Use `Restart=on-failure` for most services and always pair it with `RestartSec`.

---

## Quick Demo

```bash
# Send signals to a process
kill -15 <pid>      # SIGTERM — graceful
kill -9 <pid>       # SIGKILL — force
kill -1 <pid>       # SIGHUP — reload

# See what signal killed a process (exit code 128 + signal number)
# Exit code 137 = 128 + 9 = killed by SIGKILL
# Exit code 143 = 128 + 15 = killed by SIGTERM

# Check a service and its PID
systemctl status sshd
# Output includes: Main PID: 823 (sshd)

# Follow service logs live
journalctl -fu sshd

# Check why a service failed
systemctl status myapp
# Look for: "Process: ExecStart=... (code=exited, status=1/FAILURE)"
# Then: journalctl -u myapp -n 30 --no-pager
```

**When `docker stop` is slow — the fix:**

```dockerfile
# Wrong — shell form, PID 1 is sh, not your app
CMD ["sh", "-c", "node server.js"]

# Right — exec form, your app IS PID 1 and receives SIGTERM directly
CMD ["node", "server.js"]
```

Or use `tini` as a proper init:
```dockerfile
RUN apt-get install -y tini
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
```

---

## Recap + Action

**Key takeaway:** `SIGTERM` means "shut down cleanly." Your app must handle it. `SIGKILL` is a last resort that cannot be caught. systemd manages service lifecycle using these same signals.

**Your action:** Pick any running service on your machine and run:
```bash
systemctl status <service-name>
journalctl -u <service-name> -n 20 --no-pager
```

Find the PID, the restart count, and the last log line.
