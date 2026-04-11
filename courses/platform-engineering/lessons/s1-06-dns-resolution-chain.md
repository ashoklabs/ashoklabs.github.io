---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-06-dns-resolution-chain/
title: "How DNS Resolution Works End-to-End"
description: You update a DNS record and half your users still hit the old server 20 minutes later. This is a TTL problem. Understand the full DNS resolution chain and you'll never be surprised again.
lesson_number: 6
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [DNS, Resolution, TTL, Networking]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-05-tcp-debugging/
prev_lesson_title: "TCP & Network Debugging"
next_lesson: /courses/platform-engineering/lessons/s1-07-dns-records-ttl/
next_lesson_title: "DNS Record Types & TTL"
---

## Hook

You change the IP in your DNS record. You wait a few minutes. You test from your laptop — the new server responds. But your CEO calls: "The site is still broken for me."

You're both looking at the same DNS record. Different results.

This is not a bug. It's DNS caching working exactly as designed. Understanding *why* is what prevents you from making this mistake during a migration.

---

## Core Concept: The DNS Resolution Chain

DNS is a hierarchical, distributed database. No single server holds all records. When your application resolves `api.stripe.com`, a chain of lookups happens — and each step caches the result.

### Step 1 — Your machine's stub resolver

The OS has a tiny built-in DNS client called the **stub resolver**. It:
1. Checks `/etc/hosts` for static overrides (checked first, always)
2. Checks the local DNS cache (`systemd-resolved` or `nscd`)
3. If not cached, forwards to the **recursive resolver** in `/etc/resolv.conf`

```bash
cat /etc/hosts          # static overrides
cat /etc/resolv.conf    # which recursive resolver to use
```

### Step 2 — Recursive resolver

This is typically:
- Your cloud VPC's resolver (e.g., `169.254.169.253` on AWS, `168.63.129.16` on Azure)
- `8.8.8.8` (Google) or `1.1.1.1` (Cloudflare) if configured manually

The recursive resolver does all the hard work and caches results. This is why different users see different results — they're using different resolvers with different cached values.

### Step 3 — Root nameservers

There are 13 logical root clusters. They don't know your IP address, but they know who runs `.com`. The recursive resolver asks a root server: **"Who handles `.com`?"**

### Step 4 — TLD nameserver

The `.com` TLD nameserver knows which authoritative nameservers handle `stripe.com`. It responds with the NS records for the domain.

### Step 5 — Authoritative nameserver

Your domain registrar (Route53, Cloudflare, etc.) runs these. They hold the actual records. The recursive resolver asks: **"What is the IP for `api.stripe.com`?"**

The authoritative server responds: `203.0.113.50`, with a TTL of 300 seconds.

### Step 6 — Caching all the way down

The recursive resolver caches this for 300 seconds and returns it to your stub resolver. Your machine caches it too.

**This is why updates are slow to propagate.** Each layer holds a copy until the TTL expires.

```
Your App
    ↓ query
Stub Resolver (machine cache)
    ↓ cache miss
Recursive Resolver (ISP/cloud cache — shared by many users)
    ↓ cache miss
Root NS → TLD NS → Authoritative NS
```

### Seeing this in action

```bash
# Walk the full chain from root servers (bypasses all caches)
dig +trace api.stripe.com

# Query your default resolver
dig api.stripe.com

# Query a specific resolver (compare results)
dig @8.8.8.8 api.stripe.com
dig @1.1.1.1 api.stripe.com

# Query the authoritative nameserver directly (no caching)
dig NS stripe.com                          # find auth NS
dig @ns1.p16.dynect.net api.stripe.com    # ask it directly
```

The TTL value in `dig` output counts down — it shows remaining cache time, not the configured TTL. To see the actual configured TTL, always query the authoritative nameserver directly.

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>During incidents: use dig +trace</strong>
    <code>dig +trace</code> bypasses your machine's cache and all intermediate resolver caches entirely — it walks from root servers every time. Use this to verify what the authoritative nameserver is actually serving, independent of any cached state.
  </div>
</div>

---

## Quick Demo

```bash
# 1. See the full resolution chain
dig +trace github.com 2>/dev/null | tail -20
# You'll see: root server → .com TLD → github.com auth NS → A record

# 2. Compare cached vs live
dig github.com | grep -A3 "ANSWER SECTION"
# The second column is remaining TTL (seconds until cache expires)

dig @8.8.8.8 github.com | grep -A3 "ANSWER SECTION"
# Different TTL remaining (different resolver, different cache age)

# 3. Query authoritative directly for the real TTL
AUTH_NS=$(dig +short NS github.com | head -1)
echo "Authoritative NS: $AUTH_NS"
dig @$AUTH_NS github.com | grep -A3 "ANSWER SECTION"
# TTL here matches what's actually configured in the DNS zone

# 4. Check your resolver
cat /etc/resolv.conf
# nameserver line shows which resolver your machine uses
```

**Expected output from `dig +trace` (abbreviated):**
```
.                       518400  IN  NS  a.root-servers.net.    ← root
com.                    172800  IN  NS  a.gtld-servers.net.    ← TLD
github.com.             172800  IN  NS  ns1.p16.dynect.net.   ← auth NS
github.com.             60      IN  A   140.82.121.3           ← the answer
```

---

## Recap + Action

**Key takeaway:** DNS changes don't propagate instantly — they wait for TTL to expire at every cache layer. The authoritative nameserver is the source of truth. Use `dig +trace` during incidents to bypass all caching.

**Your action:** Run `dig +trace github.com` and identify each of the four layers in the output: root nameserver, TLD nameserver, authoritative nameserver, and the final A record.
