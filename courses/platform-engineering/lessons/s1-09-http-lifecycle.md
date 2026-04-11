---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-09-http-lifecycle/
title: "HTTP Request/Response Lifecycle"
description: A 502 and a 504 look similar in your monitoring dashboard. They have completely different causes and point to different places in your stack. Master HTTP anatomy and status codes.
lesson_number: 9
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [HTTP, Status Codes, Headers, API]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-08-dns-kubernetes/
prev_lesson_title: "DNS in Kubernetes"
next_lesson: /courses/platform-engineering/lessons/s1-10-http2-tls/
next_lesson_title: "HTTP/2 & TLS"
---

## Hook

Your monitoring shows a spike in 5xx errors. You open the alert: `502 Bad Gateway`.

Your teammate opens a similar alert from last month: `504 Gateway Timeout`.

Same dashboard. Same graph shape. Completely different problems.

- **502** = your upstream service responded with garbage, or crashed mid-response
- **504** = your upstream service didn't respond at all within the timeout

If you treat them the same, you'll look in the wrong place. Understanding HTTP status codes at this level is a core platform engineering skill.

---

## Core Concept: HTTP Anatomy

### The request structure

```
GET /api/orders/789 HTTP/1.1\r\n
Host: api.example.com\r\n
Authorization: Bearer eyJhbGc...\r\n
Accept: application/json\r\n
X-Request-ID: abc-123\r\n
\r\n
```

Three parts:
1. **Request line** — Method + path + version
2. **Headers** — Key-value metadata, one per line
3. **Blank line** — signals end of headers; body follows (for POST/PUT/PATCH)

### HTTP methods — semantics matter

| Method | Meaning | Safe? | Idempotent? |
|--------|---------|-------|-------------|
| GET | Read a resource | Yes | Yes |
| POST | Create / submit | No | No |
| PUT | Replace entire resource | No | Yes |
| PATCH | Partial update | No | No |
| DELETE | Remove | No | Yes |

**Why idempotency matters for platform engineers:** Load balancers and service meshes can safely retry idempotent requests on failure. If your LB retries a failed POST, you may create duplicate records. Design your APIs with this in mind — use idempotency keys for payments.

### Status codes that platform engineers must know cold

**2xx — Success**

| Code | Meaning | When to use |
|------|---------|------------|
| 200 | OK | Standard success |
| 201 | Created | POST that created a resource (include `Location` header) |
| 204 | No Content | DELETE or action with no response body |
| 206 | Partial Content | Range requests (file streaming) |

**3xx — Redirects**

| Code | Meaning | Platform concern |
|------|---------|-----------------|
| 301 | Moved Permanently | **Browser caches this forever** — use 302 if you might change it |
| 302 | Found (Temporary) | Browser follows, doesn't cache |
| 307 | Temporary Redirect | Like 302 but preserves the HTTP method |
| 308 | Permanent Redirect | Like 301 but preserves the HTTP method |

**4xx — Client errors**

| Code | Meaning | Key distinction |
|------|---------|----------------|
| 400 | Bad Request | Malformed input |
| 401 | Unauthorized | "You need to authenticate" — no or invalid credentials |
| 403 | Forbidden | "You're authenticated but not allowed" — valid credentials, wrong permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or state conflict |
| 422 | Unprocessable Entity | Input is well-formed but semantically invalid |
| 429 | Too Many Requests | Rate limited — always include `Retry-After` header |

**5xx — Server errors (the ones you'll debug at 2am)**

| Code | Meaning | Root cause |
|------|---------|-----------|
| 500 | Internal Server Error | Unhandled exception in the app |
| 502 | Bad Gateway | Upstream crashed or returned an invalid response |
| 503 | Service Unavailable | Upstream is down or overloaded |
| 504 | Gateway Timeout | Upstream didn't respond before the timeout |

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>502 vs 504 diagnostic path</strong>
    <strong>502</strong>: Check if the upstream service is running and didn't crash mid-response. Look for OOM kills, panics, or process restarts. <strong>504</strong>: The service is running but slow. Check database query times, downstream service latency, and whether the timeout is configured appropriately. They require completely different investigations.
  </div>
</div>

### Important request headers for platform engineers

```
Authorization: Bearer <jwt>          # authentication token
X-Request-ID: abc-123-def            # distributed tracing (generate on ingress)
X-Forwarded-For: 203.0.113.1         # client IP passed through proxies
Content-Type: application/json       # format of the request body
Accept: application/json             # format the client wants in response
```

**Security warning on X-Forwarded-For:** Clients can spoof this header. Only trust it if it's set by your load balancer, and ensure your LB overwrites rather than appends.

### Important response headers

```
Content-Type: application/json; charset=utf-8
Cache-Control: max-age=3600, public   # cache for 1 hour
Cache-Control: no-store               # never cache (use for sensitive data)
Retry-After: 30                       # tell client when to retry after 429
X-Request-ID: abc-123                 # echo back for tracing
```

---

## Quick Demo

```bash
# See a full HTTP exchange
curl -v https://httpbin.org/get

# Measure each phase of the request
curl -w "\n\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s https://httpbin.org/get

# Trigger specific status codes to understand them
curl -I https://httpbin.org/status/200   # 200 OK
curl -I https://httpbin.org/status/301   # 301 Redirect
curl -I https://httpbin.org/status/401   # 401 Unauthorized
curl -I https://httpbin.org/status/404   # 404 Not Found
curl -I https://httpbin.org/status/429   # 429 Too Many Requests
curl -I https://httpbin.org/status/503   # 503 Service Unavailable

# Follow a redirect chain
curl -L -v https://httpbin.org/redirect/3 2>&1 | grep -E "(> GET|< HTTP)"
# Shows: each redirect hop with its Location header

# Send headers and a POST body
curl -X POST https://httpbin.org/post \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-123" \
  -d '{"user": "alice", "action": "login"}'
```

**Expected `curl -v` output (key parts):**
```
* Connected to httpbin.org (34.235.32.249) port 443
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
> GET /get HTTP/2
> Host: httpbin.org
> User-Agent: curl/7.88.1
>
< HTTP/2 200
< content-type: application/json
< content-length: 389
```

---

## Recap + Action

**Key takeaway:** 502 = upstream returned garbage or crashed. 504 = upstream too slow. 401 = not authenticated. 403 = not authorised. These distinctions tell you exactly where to look next.

**Your action:** Run `curl -v https://httpbin.org/get` and identify: the TLS version, the HTTP version, the status code, and the response headers. Then run the timing command and note how long each phase takes.
