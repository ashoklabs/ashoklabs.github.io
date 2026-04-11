---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-10-http2-tls/
title: "HTTP/2, HTTP/3 & the TLS Handshake"
description: Your frontend makes 40 requests per page load. HTTP/1.1 makes this painful. HTTP/2 makes it not matter. TLS 1.3 cuts the connection overhead in half. Here's how both actually work.
lesson_number: 10
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [HTTP2, TLS, HTTPS, Performance, Security]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-09-http-lifecycle/
prev_lesson_title: "HTTP Request/Response Lifecycle"
next_lesson: /courses/platform-engineering/lessons/s1-11-git-internals/
next_lesson_title: "Git Internals & Branching"
---

## Hook

A frontend engineer complains: "The page feels slow even though the API responses are fast."

You pull up the network waterfall in Chrome DevTools. You see 40 requests, each starting *after* the previous one finishes. They're loading sequentially over HTTP/1.1.

You add a single nginx config line: `http2 on;`

Suddenly those 40 requests load in parallel. Page load time drops from 4.2 seconds to 0.9 seconds. The only change: the transport protocol.

This is why HTTP/2 matters.

---

## Core Concept: HTTP/2 and Why It Exists

### The HTTP/1.1 problem: head-of-line blocking

HTTP/1.1 processes one request at a time per connection. If the first request is slow, every subsequent request on that connection waits. Browsers work around this by opening **6 parallel connections per domain** — but that's a hack.

```
HTTP/1.1 (3 connections × 2 requests each):
Conn1: [Req A    ][Req D]
Conn2: [Req B       ][Req E]
Conn3: [Req C  ][Req F  ]
         time →
```

### HTTP/2: multiplexed streams on one connection

HTTP/2 introduces **streams** — multiple logical request/response pairs over a single TCP connection. A slow request on stream 3 does not block a fast request on stream 5.

```
HTTP/2 (1 connection, 6 concurrent streams):
Stream 1: [Req A                 ]
Stream 3: [Req B     ]
Stream 5: [Req C  ]
Stream 7: [Req D                        ]
Stream 9: [Req E             ]
Stream 11:[Req F   ]
           time →
```

All on a single TCP connection, in parallel.

### HTTP/2 key features

- **Binary framing** — requests/responses are encoded as binary frames, not human-readable text. More efficient parsing, smaller overhead.
- **Header compression (HPACK)** — repeated headers (like `Authorization`, `User-Agent`) are compressed. Saves bandwidth on high-frequency API calls.
- **Server push** — server can proactively send resources (CSS, JS) before the client asks. Mostly replaced by HTTP preload hints in practice.
- **Stream prioritisation** — critical resources (HTML) can be prioritised over decorative ones (analytics).

```bash
# Test if a server supports HTTP/2
curl -I --http2 https://github.com 2>/dev/null | head -1
# HTTP/2 200

# Compare connection reuse
curl -v --http2 https://github.com 2>&1 | grep "HTTP/2 stream"
# Shows multiple requests on one connection
```

### HTTP/3 and QUIC — the next step

HTTP/2 still has a problem: it's built on TCP, and TCP has its own head-of-line blocking at the packet level. A single dropped packet stalls all streams until TCP retransmits it.

HTTP/3 replaces TCP with **QUIC** — a protocol built on UDP that implements reliability and ordering per-stream in user-space:

- Each stream is independent — a dropped packet on stream 3 doesn't block stream 5
- **0-RTT connection resumption** — returning clients can send data before the handshake completes
- **Connection migration** — switching from WiFi to cellular doesn't drop the connection (QUIC IDs by connection token, not IP:port)

---

## Core Concept: TLS — How HTTPS Works

TLS (Transport Layer Security) is the encryption layer under HTTPS. Every HTTPS connection starts with a TLS handshake to establish shared encryption keys.

### TLS 1.3 Handshake (modern, 1 round trip)

```
Client                                   Server
  |                                         |
  |-- ClientHello (key shares, ciphers) --→ |   RTT 0 begins
  |←-- ServerHello + Certificate + Finish --|   RTT 0 completes
  |-- Finished ---------------------------→ |
  |                                         |
  |======= Encrypted data starts ===========|
```

TLS 1.3 does it in **1 round trip**. For a client with 50ms RTT to the server:
- TCP handshake: 50ms
- TLS handshake: 50ms
- First data: starts at 100ms

### TLS 1.2 Handshake (older, 2 round trips)

```
Client                                   Server
  |-- ClientHello --------------------→  |   RTT 0
  |←-- ServerHello + Certificate -----  |
  |-- ClientKeyExchange + ChangeCipher→  |   RTT 1
  |←-- ChangeCipherSpec + Finished ---   |
  |-- Finished ---------------------------→|
  |======= Encrypted data starts ==========|
```

TLS 1.2 takes **2 round trips** = 100ms for the TLS layer alone. This is why upgrading to TLS 1.3 is a meaningful performance improvement.

### Certificate validation — what clients check

When your browser or service connects to `api.example.com`:

1. **Hostname match** — does the cert's Subject Alternative Name include `api.example.com`?
2. **Expiry** — is today between `notBefore` and `notAfter`?
3. **Chain of trust** — is the cert signed by a CA that chains to a trusted root in the OS/browser trust store?

```bash
# Inspect a certificate from the command line
openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null \
  | openssl x509 -noout -text \
  | grep -E "(Subject:|DNS:|Not (Before|After))"

# Quick expiry check
echo | openssl s_client -connect github.com:443 2>/dev/null \
  | openssl x509 -noout -dates

# Check which TLS version a server supports
openssl s_client -connect github.com:443 -tls1_2 </dev/null 2>&1 | grep "Protocol"
openssl s_client -connect github.com:443 -tls1_3 </dev/null 2>&1 | grep "Protocol"
```

### Security headers that belong on every HTTPS response

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
# Forces HTTPS for 1 year — clients refuse plain HTTP even if they try it

X-Content-Type-Options: nosniff
# Prevents browsers from guessing content type (stops a class of XSS attacks)

X-Frame-Options: DENY
# Prevents your site from being embedded in an iframe (clickjacking protection)

Content-Security-Policy: default-src 'self'
# Defines which sources can load content — most powerful XSS defence
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>Never use -k / --insecure in production scripts</strong>
    <code>curl -k</code> and <code>requests.get(verify=False)</code> disable all TLS certificate validation. Anyone on the network can intercept the traffic with a self-signed cert. Fix the certificate issue rather than bypassing verification.
  </div>
</div>

---

## Quick Demo

```bash
# 1. Confirm HTTP/2 is being used
curl -v --http2 https://httpbin.org/get 2>&1 | grep -E "(HTTP/|Using HTTP)"

# 2. Time each phase of an HTTPS connection
curl -w "\nDNS lookup:  %{time_namelookup}s
TCP connect: %{time_connect}s
TLS done:    %{time_appconnect}s
First byte:  %{time_starttransfer}s
Total:       %{time_total}s\n" \
  -o /dev/null -s https://github.com

# Expected:
# DNS lookup:  0.008s
# TCP connect: 0.028s    ← TCP RTT
# TLS done:    0.077s    ← TLS adds ~49ms (1 RTT)
# First byte:  0.132s
# Total:       0.215s

# 3. Check TLS certificate details
echo | openssl s_client -connect github.com:443 -servername github.com 2>/dev/null \
  | openssl x509 -noout -dates -subject

# 4. Check security headers
curl -sI https://github.com | grep -iE "(strict-transport|x-frame|x-content-type|content-security)"
```

---

## Recap + Action

**Key takeaway:** HTTP/2 multiplexes many requests over one connection — it eliminates the 6-connections-per-domain hack. TLS 1.3 cuts the handshake to 1 RTT. Both are table stakes for production services in 2025.

**Your action:** Run the timing command against any HTTPS site you use:
```bash
curl -w "TLS overhead: %{time_appconnect}s\nServer latency: %{time_starttransfer}s\n" \
  -o /dev/null -s https://your-service.com
```

Calculate: how much time is TLS vs how much is server processing?
