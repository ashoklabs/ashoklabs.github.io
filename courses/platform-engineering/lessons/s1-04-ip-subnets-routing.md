---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-04-ip-subnets-routing/
title: "IP Addresses, Subnets & Routing"
description: "Kubernetes pod can't talk to a service. The networking team says 'check the subnet ranges.' Do you know what they mean? This lesson makes IP addressing and routing second nature."
lesson_number: 4
duration: 10 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Networking, IP, Subnets, CIDR, Routing]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-03-cgroups-namespaces/
prev_lesson_title: "cgroups & Namespaces"
next_lesson: /courses/platform-engineering/lessons/s1-05-tcp-debugging/
next_lesson_title: "TCP & Network Debugging"
---

## Hook

You're designing a new AWS VPC for a Kubernetes cluster. The cloud architect asks:

*"What CIDR do you want for the pod network? Keep in mind your node subnets will be /24s and we'll have three availability zones."*

If you're not sure what to say — this lesson is for you.

Getting CIDR wrong early is painful. Run out of IPs in your pod subnet and you can't schedule new pods. Overlap your VPC range with a corporate network and your VPN breaks. The math is simple once you see it.

---

## Core Concept: IP Addressing and CIDR

### IPv4 structure

An IPv4 address is 32 bits written as four octets: `10.0.1.50`

In binary: `00001010.00000000.00000001.00110010`

### CIDR notation — the slash number

`10.0.1.0/24` means: the first **24 bits** are the network address, the remaining **8 bits** are host addresses.

The slash number is called the **prefix length**. A larger number means a smaller network.

### The mental math you need

| CIDR | Host bits | Total IPs | Usable IPs |
|------|-----------|-----------|-----------|
| /32  | 0  | 1        | 1 (single host route) |
| /30  | 2  | 4        | 2 (point-to-point link) |
| /28  | 4  | 16       | 14 |
| /27  | 5  | 32       | 30 |
| /26  | 6  | 64       | 62 |
| /24  | 8  | 256      | 254 |
| /22  | 10 | 1,024    | 1,022 |
| /20  | 12 | 4,096    | 4,094 |
| /16  | 16 | 65,536   | 65,534 |

**Formula:** `2^(32 - prefix) = total IPs`. Subtract 2 for network and broadcast addresses.

**Cloud providers subtract more:** AWS reserves 5 IPs per subnet (network, broadcast, router, DNS, future). A `/24` on AWS gives you 251 usable IPs, not 254.

### Private address ranges (RFC 1918)

These ranges are never routed on the public internet:
- `10.0.0.0/8` — large orgs, Kubernetes pod networks
- `172.16.0.0/12` — Docker's default bridge network
- `192.168.0.0/16` — home networks, small office

### Routing — how packets find their destination

When a packet leaves your machine, the kernel looks up the **routing table** to decide where to send it:

```bash
ip route show

# Typical output on a cloud VM:
default via 10.0.1.1 dev eth0         # default: send everything to the gateway
10.0.1.0/24 dev eth0 proto kernel     # local subnet: send directly
169.254.0.0/16 dev eth0 proto dhcp    # link-local: AWS metadata service
```

Reading this: "If the destination matches `10.0.1.0/24`, send it directly out `eth0`. For everything else, send it to `10.0.1.1` (the gateway)."

**Longest prefix match:** When multiple routes match a destination, the most specific (longest prefix) wins. `/24` beats `/16` beats `default` (`/0`).

```bash
# See exactly which route will be used for a destination
ip route get 8.8.8.8
# Output: 8.8.8.8 via 10.0.1.1 dev eth0 src 10.0.1.50

ip route get 10.0.1.75
# Output: 10.0.1.75 dev eth0 src 10.0.1.50   (direct, no gateway)
```

### Kubernetes networking — why CIDR planning matters

A Kubernetes cluster has three CIDR ranges that must not overlap:
1. **Node CIDR** — IPs for the nodes themselves (e.g. `10.0.0.0/16`)
2. **Pod CIDR** — IPs assigned to pods (e.g. `10.244.0.0/16`) — needs to be large
3. **Service CIDR** — virtual IPs for Services (e.g. `10.96.0.0/12`)

Plus: none of these should overlap with your corporate VPN or on-premise network ranges.

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>Pod CIDR sizing rule of thumb</strong>
    Each node gets a <code>/24</code> slice of the pod CIDR (256 IPs, typically 110 pods per node in Kubernetes default). For a cluster of 100 nodes you need 100 × 256 = 25,600 IPs minimum — a <code>/14</code> pod CIDR. Size generously; you can't change it after cluster creation without rebuilding.
  </div>
</div>

---

## Quick Demo

```bash
# Show your machine's IP addresses and subnets
ip addr show
# Look for: inet 10.0.1.50/24 — your IP is 10.0.1.50, subnet is /24

# Show the routing table
ip route show

# Find the route to a specific destination
ip route get 1.1.1.1
ip route get 10.0.1.100

# Subnet calculator (install if not available)
ipcalc 10.0.0.0/20
# Output:
# Network:   10.0.0.0
# Netmask:   255.255.240.0
# Broadcast: 10.0.15.255
# Hosts:     4094

# Check if two CIDRs overlap (quick manual check)
# 10.0.0.0/16 = 10.0.0.0 — 10.0.255.255
# 10.0.4.0/24 = 10.0.4.0 — 10.0.4.255  ← overlaps with /16
```

---

## Recap + Action

**Key takeaway:** CIDR prefix length controls subnet size. `2^(32-prefix)` gives total IPs. Routing tables use longest-prefix-match. In Kubernetes, plan three non-overlapping CIDRs from the start — you can't change them later.

**Your action:** Run `ip addr show` and `ip route show` on any machine. Calculate how many hosts fit in your current subnet, and identify which route handles traffic to `8.8.8.8`.
