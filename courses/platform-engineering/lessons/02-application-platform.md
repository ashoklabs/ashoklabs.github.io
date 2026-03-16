---
layout: lesson
permalink: /courses/platform-engineering/lessons/02-application-platform/
title: Application Platform
description: Understand the building blocks of production application platforms — microservices, API services, async workers, databases, and how platforms host them all reliably.
lesson_number: 2
duration: 50 min
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Microservices, Databases, Architecture]

# Replace with your actual YouTube unlisted video ID
video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/01-engineering-foundations/
prev_lesson_title: Engineering Foundations
next_lesson: /courses/platform-engineering/lessons/03-containerisation/
next_lesson_title: Containerisation
---

## What You Will Learn

By the end of this lesson you will be able to:

- Explain when microservices are — and are not — the right choice
- Design an API service and an async worker service correctly
- Choose between SQL, NoSQL, and time-series databases for different workloads
- Understand service communication patterns (sync vs async)
- Describe the contract between an application team and a platform team

---

## 1. Microservices vs Monolith

Platform engineers do not build applications — but they must deeply understand them to build platforms that host them well.

### When microservices make sense

```
Monolith → Good for:           Microservices → Good for:
  • Small teams (< 8 people)     • Large teams (multiple squads)
  • Early-stage products         • Independent deployment needed
  • Simple domain                • Different scaling requirements
  • Low operational maturity     • Polyglot technology choices
```

<div class="callout callout--info">
  <span class="callout-icon">📌</span>
  <div class="callout-body">
    <strong>Platform engineer perspective</strong>
    You will be asked to host both. Your platform must support both well. The operational cost of microservices is <em>your</em> problem to solve — not the application team's.
  </div>
</div>

---

## 2. Service Types

Production application platforms host three fundamental service types:

### API services (synchronous)

```
Client ──── HTTP/gRPC ────→ API Service
                                │
                         ┌──── ▼ ────┐
                         │  Database  │
                         └───────────┘
```

Characteristics:
- Stateless — horizontal scaling is straightforward
- Respond within a deadline (typically < 500ms)
- Expose health endpoints: `/healthz`, `/readyz`, `/metrics`

### Worker services (asynchronous)

```
Producer ──→ Message Queue ──→ Worker Service
              (SQS / Kafka)         │
                              ┌──── ▼ ────┐
                              │  Database  │
                              └───────────┘
```

Characteristics:
- Process jobs from a queue — pace controlled by queue depth
- Must be idempotent (safe to retry on failure)
- No client waiting — failure doesn't cause a timeout cascade

### Scheduled services (cron jobs)

```bash
# Kubernetes CronJob example
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-report
spec:
  schedule: "0 2 * * *"       # 02:00 UTC daily
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: reporter
            image: myapp/reporter:v1.2.0
```

---

## 3. Database Selection

One of the most consequential platform decisions is which databases you support.

### Decision framework

| Workload                        | Database type          | Examples                  |
|---------------------------------|------------------------|---------------------------|
| Transactional (OLTP)            | Relational (SQL)       | PostgreSQL, MySQL         |
| Document storage                | Document               | MongoDB, DynamoDB         |
| Time-series metrics             | Time-series            | InfluxDB, TimescaleDB     |
| Caching / sessions              | Key-value              | Redis, Memcached          |
| Full-text search                | Search                 | Elasticsearch, OpenSearch |
| Graph relationships             | Graph                  | Neo4j, AWS Neptune        |

### The platform's database responsibilities

Your platform must provide:

```
Application team asks for: "PostgreSQL 15, 100GB, HA"

Platform provides:
  ✓ Provisioning (Terraform, Helm, operator)
  ✓ Backups (automated, tested, point-in-time recovery)
  ✓ Monitoring (connections, replication lag, slow queries)
  ✓ Patching (zero-downtime upgrades)
  ✓ Connection pooling (PgBouncer/ProxySQL)
  ✓ Secrets rotation
```

---

## 4. Service Communication Patterns

### Synchronous (request/response)

```bash
# REST
GET /api/v1/orders/123
Authorization: Bearer <token>

# gRPC (from a .proto definition)
rpc GetOrder (GetOrderRequest) returns (Order);
```

Use synchronous communication when:
- The caller needs the result immediately
- Latency SLO is tight
- The operation must complete atomically

### Asynchronous (event-driven)

```python
# Producer — publishes an event
producer.send("order-events", {
    "type":     "order.created",
    "order_id": "123",
    "timestamp": "2026-03-16T10:00:00Z"
})

# Consumer — processes events independently
@consumer.subscribe("order-events")
def handle_order_created(event):
    send_confirmation_email(event["order_id"])
    update_inventory(event["order_id"])
```

Use asynchronous communication when:
- The caller does not need an immediate response
- You want to decouple producers from consumers
- The processing may be slow (e.g., sending emails, generating reports)

---

## 5. The Platform–Application Contract

As a platform engineer, you must define a clear contract for application teams:

```yaml
# Example: platform contract (Service Level Agreement)
compute:
  cpu_request:   "100m"
  memory_request: "128Mi"
  cpu_limit:     "500m"
  memory_limit:  "512Mi"

health_checks:
  liveness:  GET /healthz   (returns 200)
  readiness: GET /readyz    (returns 200 when ready to serve traffic)
  startup:   GET /startupz  (returns 200 once initialised)

observability:
  metrics: expose /metrics in Prometheus format
  logs:    write structured JSON to stdout
  traces:  instrument with OpenTelemetry SDK

graceful_shutdown:
  - handle SIGTERM signal
  - stop accepting new requests
  - finish in-flight requests within 30s
  - exit with code 0
```

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>Golden path</strong>
    The best platform teams define a "golden path" — a blessed way of deploying that comes with everything pre-configured. Teams that follow the golden path get observability, scaling, and reliability for free.
  </div>
</div>

---

## 6. Hands-on Exercise

1. Draw an architecture diagram for a simple e-commerce system with:
   - An API service (order management)
   - A worker service (email notifications)
   - A PostgreSQL database
   - A Redis cache
   - A message queue

2. Write a Kubernetes `Deployment` manifest for a stateless API service that:
   - Defines resource requests and limits
   - Includes liveness and readiness probes
   - Sets 3 replicas

---

## Summary

| Concept              | Key takeaway                                                   |
|----------------------|----------------------------------------------------------------|
| Service types        | API (sync), Worker (async), CronJob (scheduled)               |
| Database selection   | Match database type to workload — no single database fits all |
| Sync vs async        | Sync for immediate results; async for decoupled processing     |
| Platform contract    | Define health checks, resource limits, and observability standards |
| Golden path          | Opinionated defaults lower cognitive load for app teams        |
