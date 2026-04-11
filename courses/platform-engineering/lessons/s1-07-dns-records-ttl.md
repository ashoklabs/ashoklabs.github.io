---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-07-dns-records-ttl/
title: "DNS Record Types & TTL Mistakes"
description: Email not delivering. CDN serving wrong content. Someone added a CNAME on the apex domain. All three are DNS record mistakes. Know your record types and the TTL rule that prevents migration disasters.
lesson_number: 7
duration: 10 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [DNS, Records, TTL, CNAME, TXT]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-06-dns-resolution-chain/
prev_lesson_title: "DNS Resolution Chain"
next_lesson: /courses/platform-engineering/lessons/s1-08-dns-kubernetes/
next_lesson_title: "DNS in Kubernetes"
---

## Hook

Three real incidents caused by DNS record mistakes:

1. **Email stops delivering** — someone changed the MX record TTL to 86400 then swapped it to the wrong mail server. Users couldn't receive email for 24 hours.

2. **CDN serves stale content** — a `CNAME` pointed to a CloudFront distribution that was deleted. DNS kept resolving but the CDN returned `404` for every request.

3. **Entire domain breaks** — engineer adds `example.com CNAME myapp.vercel.app`. RFC forbids CNAMEs on apex domains. The zone becomes invalid and nothing resolves.

Know your record types. Get TTL right before migrations. These incidents are 100% preventable.

---

## Core Concept: DNS Record Types

### A and AAAA — the core address records

```
api.example.com.   300  IN  A      203.0.113.50      ← IPv4
api.example.com.   300  IN  AAAA   2001:db8::1       ← IPv6
```

The trailing dot means "fully qualified domain name." The `300` is TTL in seconds.

### CNAME — alias to another name

```
www.example.com.   300  IN  CNAME  example.com.
cdn.example.com.   300  IN  CNAME  d1234.cloudfront.net.
```

A CNAME points one name at another name. The resolver follows the chain until it hits an A record.

**Two rules you must not break:**
1. **No CNAME on the apex domain** (`example.com` — the root of your zone). RFC 1034 forbids it because the apex must have NS and SOA records, which can't coexist with a CNAME. Use Route 53 ALIAS or Cloudflare's CNAME flattening instead.
2. **No other records alongside a CNAME** on the same name. A name is either a CNAME (alias) or has its own records — never both.

### MX — mail routing

```
example.com.  300  IN  MX  10  mail1.example.com.
example.com.  300  IN  MX  20  mail2.example.com.
```

Lower preference number = higher priority. `mail1` receives email first; `mail2` is the backup.

### TXT — arbitrary text (used for verification and email security)

```
example.com.  300  IN  TXT  "v=spf1 include:_spf.google.com ~all"
example.com.  300  IN  TXT  "google-site-verification=abc123"
```

TXT records are used for:
- **SPF** — which servers are allowed to send email for your domain
- **DKIM** — public key for email signature verification
- **Domain ownership** — Google, GitHub, AWS certificate validation
- **ACME DNS-01** — Let's Encrypt wildcard certificate challenges

### NS — nameserver delegation

```
example.com.  172800  IN  NS  ns1.example.com.
example.com.  172800  IN  NS  ns2.example.com.
```

NS records delegate authority over a zone to specific nameservers. Long TTL (48h) because these rarely change. Changing NS records is how you migrate between DNS providers.

### SRV — service discovery

```
_postgres._tcp.db.example.com.  300  IN  SRV  10 5 5432 pg-primary.example.com.
# priority  weight  port  target
```

SRV records let clients discover service endpoints with port numbers baked into DNS — no hardcoded config. Used by etcd, Kubernetes, and some databases.

---

## Core Concept: TTL — The Pre-Migration Rule

TTL (Time to Live) tells resolvers how long to cache a record. Get it wrong before a migration and you're stuck waiting for caches to expire.

### The two TTL failure modes

**Failure mode 1 — TTL too high during migration**

You need to move `api.example.com` from `10.0.0.1` to `10.0.0.2`. Current TTL is 3600 (1 hour). You make the change. Some users hit the new server immediately. Others hit the old server for up to an hour as their cache expires. If the old server is shut down before all caches expire, those users see errors.

**Failure mode 2 — Forgetting negative caching**

You accidentally delete a record. Clients query it and get `NXDOMAIN`. Resolvers cache this negative response for the SOA MINIMUM TTL. You recreate the record 2 minutes later — but clients that cached the NXDOMAIN keep getting errors until the negative TTL expires.

### The pre-migration TTL pattern

```
Days before migration:
  1. Lower TTL to 60 seconds
  2. Wait > 1× old TTL (so all caches see the new TTL)

Day of migration:
  3. Make the IP change
  4. Propagation is now ≤ 60 seconds

After migration is stable (days later):
  5. Raise TTL back to 3600
```

```bash
# Check current TTL of a record
dig api.example.com | awk '/ANSWER SECTION/{found=1} found{print; if(/^$/) exit}'
# The second column is remaining TTL from the queried resolver

# Check the actual configured TTL (query authoritative directly)
dig NS example.com +short
dig @<auth-ns> api.example.com
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>The most common DNS migration mistake</strong>
    Lowering TTL <em>after</em> you start migrating instead of before. If your TTL was 3600 and you lower it to 60 at the same time as changing the IP, some resolvers cached the old record at 3600s and will hold it for up to an hour. Always lower TTL first, wait, then change.
  </div>
</div>

---

## Quick Demo

```bash
# Inspect all record types for a domain
dig A github.com +short
dig MX github.com
dig TXT github.com
dig NS github.com

# Verify no CNAME on apex (should return nothing or SOA)
dig CNAME github.com

# Check if a CNAME chain resolves
dig CNAME www.github.com     # shows what it aliases to
dig A www.github.com         # follows chain to final IP

# See negative caching TTL (SOA MINIMUM field)
dig SOA github.com
# Last number in the SOA record is negative cache TTL
```

**Example output for `dig MX github.com`:**
```
;; ANSWER SECTION:
github.com.   3600  IN  MX  1  aspmx.l.google.com.
github.com.   3600  IN  MX  5  alt1.aspmx.l.google.com.
```

---

## Recap + Action

**Key takeaway:** Know your record types. Never put a CNAME on the apex domain. Always lower TTL *before* a migration, not during it.

**Your action:** Pick any domain you manage or test with. Run:
```bash
dig A example.com
dig MX example.com
dig TXT example.com
```

For each record, note the TTL. If any A record has TTL > 3600 and you control that domain, consider whether a future migration would be painful.
