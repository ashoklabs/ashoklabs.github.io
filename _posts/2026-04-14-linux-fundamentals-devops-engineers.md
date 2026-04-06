---
title: "Linux Fundamentals Every DevOps Engineer Must Know"
categories: [devops, linux]
date: 2026-04-14
image: https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&q=80
description: The Linux commands and concepts that show up in every production incident. Not the full manual — just the ones that matter for DevOps work.
---

# Linux Fundamentals Every DevOps Engineer Must Know

**Primary keyword:** Linux fundamentals DevOps
**Secondary keywords:** Linux commands for DevOps engineers, Linux for DevOps beginners, Linux DevOps skills

---

## Introduction

Everything in DevOps runs on Linux. Containers are Linux. Kubernetes nodes are Linux. Your CI runners are Linux. When something breaks in production, the investigation starts at the Linux level — checking logs, inspecting processes, tracing network connections. This guide covers the Linux fundamentals that come up repeatedly in real DevOps work: not the full Unix philosophy, but the specific commands and concepts that will save you during an incident or a debugging session.

---

## File System Navigation and Permissions

The Linux file system is the foundation. These commands should feel automatic.

```bash
# Navigation
pwd                   # where am I?
ls -la                # list all files including hidden, with permissions
cd /var/log           # change directory
find /etc -name "*.conf"   # find all .conf files in /etc
```

File permissions use the octal notation you'll see everywhere:

```bash
# Permission breakdown: rwxr-xr--
# Owner: rwx (7) | Group: r-x (5) | Others: r-- (4)
chmod 755 deploy.sh   # owner can execute, group and others can read
chown app:app /srv/myapp  # change owner and group
```

**Why it matters in DevOps:** Container image files, SSH keys, and application config files all have specific permission requirements. A wrong chmod is a common source of "permission denied" errors in containers.

---

## Process Management

Understanding running processes is essential during incidents.

```bash
# View running processes
ps aux                       # all processes with details
ps aux | grep nginx          # find nginx processes
top                          # interactive process viewer
htop                         # better interactive viewer (usually installed)

# Signals
kill -15 <pid>               # graceful shutdown (SIGTERM)
kill -9 <pid>                # force kill (SIGKILL) — use as last resort

# Systemd services
systemctl status nginx       # check service status
systemctl start/stop/restart nginx
systemctl enable nginx       # start on boot
journalctl -u nginx -f       # follow nginx logs via systemd
journalctl -u nginx --since "1 hour ago"
```

**Why it matters in DevOps:** When a pod is crashing, the first step is understanding what the process is doing. `journalctl` and `systemctl` are your first line of investigation for systemd-managed services on nodes.

---

## Network Diagnostics

This is the section that separates engineers who can trace a problem from those who can't.

```bash
# Check what's listening on which ports
ss -tulnp                    # modern replacement for netstat
netstat -tulnp               # older but widely available

# Test connectivity
nc -zv myservice.internal 8080       # is port 8080 reachable?
curl -v https://api.example.com/health   # inspect full HTTP request/response
curl -I https://api.example.com          # headers only
telnet myhost 5432           # test database port connectivity

# DNS resolution
nslookup myservice.internal  # basic DNS lookup
dig myservice.internal       # detailed DNS response including TTL
dig myservice.internal @8.8.8.8  # query specific DNS server

# Trace network path
traceroute api.example.com   # trace hops to a host
mtr api.example.com          # better traceroute with real-time stats
```

**Why it matters in DevOps:** "Service can't connect to database" is one of the most common production issues. The diagnostic sequence is: `nc` to test port connectivity → `nslookup/dig` to verify DNS → `curl` to test the full HTTP layer. Know this sequence by heart.

---

## Log Inspection

Fast log searching is a core production skill.

```bash
# Tail a live log
tail -f /var/log/nginx/access.log

# Search within a file
grep "ERROR" /var/log/app.log
grep -i "timeout" /var/log/app.log     # case insensitive
grep -n "connection refused" /var/log/app.log  # show line numbers
grep -A 5 "CRITICAL" /var/log/app.log  # show 5 lines after match

# Filter with awk
awk '{print $1, $9}' /var/log/nginx/access.log  # print columns 1 and 9

# Stream processing
tail -f /var/log/app.log | grep "ERROR"   # live filtering
cat /var/log/app.log | grep "500" | wc -l  # count 500 errors
```

**Why it matters in DevOps:** When an alert fires at 2am, you're reading logs to find the error. Fast grep and tail skills mean the difference between a 5-minute investigation and a 30-minute one.

---

## Disk and Resource Usage

Running out of disk is one of the most preventable production incidents.

```bash
# Disk usage
df -h                        # disk usage by filesystem, human-readable
du -sh /var/log/*            # size of each item in /var/log
du -sh * | sort -h           # sort by size

# Memory
free -h                      # memory usage summary
cat /proc/meminfo            # detailed memory info

# CPU and load
uptime                       # load averages (1, 5, 15 minute)
vmstat 1 5                   # system stats every 1 second, 5 times
iostat -x 1                  # disk I/O stats
```

**Why it matters in DevOps:** "Pod OOMKilled" and "disk full" alerts are common. Diagnosing them requires knowing where memory is going and which directories are consuming disk.

---

## Shell Scripting Basics

DevOps automation requires writing shell scripts that are reliable and readable.

```bash
#!/bin/bash
set -euo pipefail  # exit on error, undefined var, pipe failure — always set this

ENVIRONMENT=${1:-"dev"}  # first arg, default to "dev"
LOG_FILE="/var/log/deploy.log"

deploy() {
  echo "$(date): Deploying to $ENVIRONMENT" | tee -a "$LOG_FILE"
  kubectl set image deployment/myapp myapp="myapp:${IMAGE_TAG}"
}

rollback() {
  echo "$(date): Rolling back" | tee -a "$LOG_FILE"
  kubectl rollout undo deployment/myapp
}

# Check if deployment succeeded
if kubectl rollout status deployment/myapp --timeout=120s; then
  echo "Deployment successful"
else
  echo "Deployment failed, rolling back"
  rollback
  exit 1
fi
```

The `set -euo pipefail` at the top is the most important line in any production shell script. Without it, errors are silently ignored and scripts continue running in broken states.

---

## Environment Variables and Configuration

```bash
# Print environment variable
echo $HOME
printenv PATH

# Set a variable (current shell only)
export DB_HOST="postgres.internal"

# Check if variable is set
if [ -z "${DB_PASSWORD:-}" ]; then
  echo "DB_PASSWORD is not set"
  exit 1
fi

# Load from a file
source .env         # or
. .env
```

**Why it matters in DevOps:** Container configuration is injected via environment variables. Understanding how they're set and inherited is fundamental to debugging containerized apps.

---

## SSH and Secure Remote Access

```bash
# Connect to a remote host
ssh -i ~/.ssh/mykey.pem user@hostname

# Copy files
scp myfile.txt user@hostname:/tmp/
rsync -av ./mydir/ user@hostname:/opt/mydir/

# Port forwarding (useful for accessing services in a cluster)
ssh -L 5432:postgres.internal:5432 bastion.example.com
# Now localhost:5432 tunnels to postgres.internal:5432 through bastion

# SSH config for shortcuts
# ~/.ssh/config
Host bastion
  HostName bastion.example.com
  User ubuntu
  IdentityFile ~/.ssh/prod.pem
```

---

## Cron and Scheduled Jobs

```bash
# Edit crontab
crontab -e

# Cron syntax: minute hour day month weekday
# Run every day at 9am on weekdays
0 9 * * 1-5 /opt/scripts/backup.sh >> /var/log/backup.log 2>&1

# Common patterns
0 * * * *     # every hour at minute 0
*/15 * * * *  # every 15 minutes
0 2 * * 0     # every Sunday at 2am

# List current crontab
crontab -l
```

---

## The Troubleshooting Sequence

When something is broken, this is the order:

1. **Check if the process is running:** `ps aux | grep <service>` or `systemctl status <service>`
2. **Check the logs:** `journalctl -u <service> -n 100` or `tail -f /var/log/<service>.log`
3. **Check network connectivity:** `ss -tulnp` to see if the port is open, `nc` to test reachability
4. **Check disk and memory:** `df -h`, `free -h`
5. **Check DNS:** `dig <hostname>` if a service can't reach another service by name

That sequence resolves the majority of production Linux issues. Have it memorized.

---

## Conclusion

Linux fluency isn't about memorizing every flag of every command. It's about having a reliable mental model of how the system works — processes, files, networking, storage — and knowing which commands to reach for when something breaks. The commands in this guide will come up in almost every production incident. Practice them in a real environment (a cheap cloud VM or local VM), not just in a course. The muscle memory is what matters.

---

**Want structured, hands-on Linux labs as part of a full DevOps curriculum?** Everything is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
