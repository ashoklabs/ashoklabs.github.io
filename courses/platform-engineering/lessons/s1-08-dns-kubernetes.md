---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-08-dns-kubernetes/
title: "DNS in Kubernetes: CoreDNS & the ndots Problem"
description: Your pod makes 6 DNS queries for every 1 external API call. CoreDNS is your silent bottleneck. Understand how Kubernetes service discovery works and how to stop wasting DNS queries.
lesson_number: 8
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [DNS, Kubernetes, CoreDNS, Service Discovery]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-07-dns-records-ttl/
prev_lesson_title: "DNS Record Types & TTL"
next_lesson: /courses/platform-engineering/lessons/s1-09-http-lifecycle/
next_lesson_title: "HTTP Request/Response Lifecycle"
---

## Hook

You're profiling a high-throughput microservice. It calls an external payment API on every request. The service handles 1,000 requests per second.

You add DNS query logging and find something unexpected: **5 DNS queries per external API call** instead of 1. CoreDNS is handling 5,000 DNS queries per second — and it's at 80% CPU.

The cause: a Kubernetes default called `ndots:5`. It causes pods to try 4 internal search domains before falling through to the actual external hostname. You can fix it in one line.

---

## Core Concept: DNS Inside Kubernetes

### CoreDNS — the cluster's internal DNS server

Every Kubernetes cluster runs **CoreDNS** — a Go-based DNS server deployed as a Kubernetes deployment in the `kube-system` namespace. All pods use it as their nameserver.

```bash
# Find CoreDNS pods
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check CoreDNS config
kubectl get configmap coredns -n kube-system -o yaml

# Check CoreDNS logs
kubectl logs -n kube-system -l k8s-app=kube-dns
```

### Service discovery — the DNS naming convention

Every Kubernetes Service gets a DNS name automatically:

```
<service>.<namespace>.svc.cluster.local
```

Examples:
- `payments.production.svc.cluster.local` — full FQDN
- `payments.production` — works from other namespaces
- `payments` — works from *within* the same namespace

```bash
# From inside a pod
nslookup payments                                    # same namespace
nslookup payments.production                         # cross-namespace
nslookup payments.production.svc.cluster.local       # full FQDN

# What a service resolves to
nslookup kubernetes.default.svc.cluster.local
# Returns: the ClusterIP of the kubernetes service
```

### What's inside a pod's /etc/resolv.conf

```bash
kubectl exec -it <pod> -- cat /etc/resolv.conf
```

Output:
```
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

Breaking this down:
- `nameserver 10.96.0.10` — CoreDNS ClusterIP
- `search` — list of domains to append if the name isn't fully qualified
- `ndots:5` — **the problem setting**

### The ndots:5 problem explained

`ndots:5` means: "if the hostname has fewer than 5 dots, try all search domains before treating it as a global FQDN."

When your pod calls `api.stripe.com` (2 dots), the resolver tries in order:

1. `api.stripe.com.default.svc.cluster.local` → NXDOMAIN
2. `api.stripe.com.svc.cluster.local` → NXDOMAIN
3. `api.stripe.com.cluster.local` → NXDOMAIN
4. `api.stripe.com.` → **success** (global lookup)

Three wasted NXDOMAIN queries before the real lookup. At high request rates this is significant CoreDNS load.

### Fixes for the ndots problem

**Option 1 — Use fully qualified domain names (trailing dot) in your app config**

```yaml
# Kubernetes ConfigMap
PAYMENT_API_URL: "https://api.stripe.com./v1/"
#                                           ^
#                               trailing dot = FQDN, skip search domains
```

**Option 2 — Reduce ndots in the pod spec**

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"    # only append search domains if fewer than 2 dots
```

**Option 3 — NodeLocal DNSCache (cluster-wide fix)**

Deploy a per-node DNS caching agent. Pods query the local node cache instead of CoreDNS pods, reducing CoreDNS load by 60-80% in large clusters.

### Headless services — DNS for StatefulSets

A normal Service gets a single ClusterIP (virtual load-balanced IP). A **headless service** (ClusterIP: None) instead returns the individual pod IPs via DNS — clients do the load balancing themselves.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None   # headless
  selector:
    app: postgres
```

DNS for a headless service returns A records for each pod:
```
postgres-headless.default.svc.cluster.local → [10.244.1.5, 10.244.2.3, 10.244.3.8]
```

StatefulSets with headless services get predictable pod DNS names:
```
postgres-0.postgres-headless.default.svc.cluster.local
postgres-1.postgres-headless.default.svc.cluster.local
```

This is how database clustering (Postgres HA, Kafka, Zookeeper) works in Kubernetes — each replica has a stable, addressable DNS name.

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>CoreDNS high availability</strong>
    Run at least 2 CoreDNS replicas with a PodDisruptionBudget. If CoreDNS crashes and you only have one replica, all pod-to-service DNS resolution fails cluster-wide. New pods that start during the outage can't resolve anything. This cascades quickly.
  </div>
</div>

---

## Quick Demo

```bash
# Debug DNS from inside a pod
kubectl run dns-debug --image=busybox --rm -it --restart=Never -- sh

# Inside the pod:
cat /etc/resolv.conf           # see ndots and search domains
nslookup kubernetes.default    # internal service (should resolve fast)
nslookup google.com            # external (may trigger multiple searches)
exit

# Check CoreDNS health
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl top pods -n kube-system -l k8s-app=kube-dns   # CPU/memory usage

# Enable CoreDNS query logging (temporarily, in dev only)
kubectl edit configmap coredns -n kube-system
# Add 'log' to the Corefile's main block:
# .:53 {
#     log          ← add this
#     errors
#     ...
# }
kubectl rollout restart deployment/coredns -n kube-system
kubectl logs -n kube-system -l k8s-app=kube-dns -f
```

**Verifying the ndots fix:**
```bash
# Before fix: query api.stripe.com, count DNS queries in CoreDNS logs
# You'll see 4 queries: 3 NXDOMAIN + 1 success

# After setting ndots:2 or using FQDN:
# You'll see 1 query: direct success
```

---

## Recap + Action

**Key takeaway:** Every Kubernetes Service gets a DNS name at `<svc>.<ns>.svc.cluster.local`. The `ndots:5` default causes multiple wasted DNS queries for external hostnames. Fix it with `ndots:2` in the pod spec or use FQDNs with a trailing dot.

**Your action:** Exec into any pod in a Kubernetes cluster you have access to and run:
```bash
cat /etc/resolv.conf
nslookup kubernetes.default
nslookup google.com
```

Count how many DNS queries are made for the external lookup vs the internal one.
