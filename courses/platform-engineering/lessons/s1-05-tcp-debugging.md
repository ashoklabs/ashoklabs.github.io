---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-05-tcp-debugging/
title: "TCP & Network Debugging"
description: "A production alert fires: service is timing out. Is it a network issue, an app issue, or dead connections? Learn to answer that in under 60 seconds with ss, tcpdump, and nc."
lesson_number: 5
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [TCP, Networking, Debugging, tcpdump, ss]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-04-ip-subnets-routing/
prev_lesson_title: "IP Addresses & Routing"
next_lesson: /courses/platform-engineering/lessons/s1-06-dns-resolution-chain/
next_lesson_title: "DNS Resolution Chain"
---

## Hook

Production alert: *"API response times spiking, some requests timing out."*

You SSH into the server. Where do you even start? The app logs look normal. CPU is fine. Disk is fine.

Then you run `ss -s` and see 4,800 connections in `CLOSE_WAIT`. That's your answer. The application has a connection leak — it's not closing database connections properly. The database is overwhelmed with half-open connections.

Knowing TCP connection states just saved you an hour of debugging.

---

## Core Concept: TCP and How to Debug It

### The three-way handshake

TCP is reliable and ordered. Before any data flows, both sides must agree to connect:

```
Client                     Server
  |                           |
  |-------- SYN ----------→   |   "I want to connect"
  |← ------- SYN-ACK ------   |   "OK, I'm ready"
  |-------- ACK ----------→   |   "Great, let's go"
  |                           |
  |======= DATA FLOWS ========|
```

Each step is one round trip. This is why TCP connection setup adds latency — and why you need **connection pools** for any service making repeated calls to a database or downstream API.

### TCP states — what they mean in production

```bash
ss -tan    # -t=TCP, -a=all states, -n=numeric
```

| State | Meaning | When it's a problem |
|-------|---------|---------------------|
| `ESTABLISHED` | Active connection, data flowing | Normal |
| `LISTEN` | Waiting for incoming connections | Normal for servers |
| `TIME_WAIT` | Connection closed, waiting for stray packets | High count = rapid connection churn (normal but watch it) |
| `CLOSE_WAIT` | Remote closed, local hasn't called `close()` | **Application bug** — not releasing connections |
| `SYN_SENT` | Handshake sent, no response yet | Firewall may be dropping SYN packets |
| `FIN_WAIT_2` | Waiting for remote FIN | Usually resolves, watch for accumulation |

**`CLOSE_WAIT` is the most important state for platform engineers.** Hundreds of CLOSE_WAIT connections on a service means the application is not calling `close()` on sockets after the remote side closes them. This leaks file descriptors and eventually brings down the service with `EMFILE: too many open files`.

### Connection refused vs connection timeout — the critical distinction

```bash
nc -zv 10.0.0.10 5432
```

- **"Connection refused"** — the host is reachable but nothing is listening on that port (or the port is blocked with RST). Diagnosis: check the service is running on the target.
- **"Connection timed out" (no response)** — packets are being dropped silently by a firewall. Diagnosis: check security groups / iptables rules.

This distinction immediately tells you where to look.

### The debugging toolkit

**`ss` — socket statistics (use this, not netstat)**

```bash
ss -tlnp          # TCP listening ports with process names
ss -tnp           # all TCP connections with process names
ss -s             # summary: total per state
ss -tnp state CLOSE-WAIT   # filter to a specific state
```

**`tcpdump` — see the actual packets**

```bash
# Watch traffic on port 5432 (postgres)
tcpdump -i eth0 port 5432

# Capture to file, open in Wireshark
tcpdump -i eth0 -w /tmp/cap.pcap

# Decode HTTP traffic in the terminal
tcpdump -i eth0 -A 'port 80 and tcp[tcpflags] & tcp-push != 0'
```

**`nc` (netcat) — raw TCP/UDP testing**

```bash
# Test if a port is open
nc -zv 10.0.0.10 5432

# Create a simple listener (useful to verify firewall rules)
nc -l -p 8080

# Connect to it from another terminal
nc 127.0.0.1 8080
```

**`traceroute` — where does the packet stop?**

```bash
traceroute -n 8.8.8.8         # ICMP trace
traceroute -T -p 443 github.com  # TCP trace on port 443
                               # bypasses ICMP filters on corporate networks
```

Stars (`* * *`) at a hop don't mean the traffic is dropping there — they mean that router doesn't respond to traceroute probes. Only if hops stop entirely does it indicate a block.

---

## Quick Demo

```bash
# 1. Check what's actually listening
ss -tlnp
# Expected: LISTEN rows for sshd (22), maybe nginx (80, 443)

# 2. Count connections by state (health check snapshot)
ss -s
# Expected output:
# Total: 142
# TCP:   89 (estab 45, closed 12, orphaned 0, timewait 30)

# 3. Find a CLOSE_WAIT accumulation
ss -tnp | grep CLOSE-WAIT | wc -l
# Normal: 0-5. Problem: >50

# 4. Test connectivity to a port
nc -zv localhost 22
# Expected: Connection to localhost 22 port [tcp/ssh] succeeded!

nc -zv localhost 9999
# Expected: nc: connect to localhost port 9999 (tcp) failed: Connection refused

# 5. Watch a TCP connection in real time
tcpdump -i lo port 22 -n &
ssh localhost echo "test" 2>/dev/null
kill %1
# Expected: SYN, SYN-ACK, ACK sequence visible in tcpdump output
```

---

## Recap + Action

**Key takeaway:** `CLOSE_WAIT = application bug (not closing sockets)`. `ESTABLISHED = healthy`. Connection refused = no process listening. Connection timeout = firewall dropping packets. Learn to distinguish these in under 30 seconds.

**Your action:** Run the following on any machine you have access to:
```bash
ss -s
ss -tlnp
```

Report: how many ESTABLISHED connections? What ports are listening? Any CLOSE_WAIT?
