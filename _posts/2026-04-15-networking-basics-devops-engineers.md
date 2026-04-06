---
title: "Networking Basics Every DevOps Engineer Needs to Know"
categories: [devops, networking]
date: 2026-04-15
image: https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80
description: Networking is where most DevOps tutorials fall short. Here are the concepts that unlock your ability to diagnose real production issues.
---

# Networking Basics Every DevOps Engineer Needs to Know

**Primary keyword:** networking basics for DevOps engineers
**Secondary keywords:** DevOps networking concepts, TCP/IP DevOps, DNS for DevOps, Kubernetes networking explained

---

## Introduction

Most DevOps tutorials jump straight from "install Kubernetes" to "configure ingress" without explaining what's actually happening in between. That gap is where production incidents live. When a pod can't reach a database, when an ingress isn't routing correctly, when a service mesh is dropping connections — the engineers who trace these issues quickly are the ones who understand what's happening at the networking layer. This guide covers the networking fundamentals that come up most often in real DevOps work.

---

## IP Addressing and Subnets

Every device on a network has an IP address. In cloud and container environments, you'll work with private IP ranges constantly.

**Private IP ranges (RFC 1918):**
- `10.0.0.0/8` — large enterprise networks, common in VPCs
- `172.16.0.0/12` — Docker's default bridge network range
- `192.168.0.0/16` — home networks, smaller environments

**CIDR notation** describes a block of IP addresses. `10.0.1.0/24` means the first 24 bits are the network, leaving 8 bits for hosts — that's 256 addresses (254 usable, minus network and broadcast).

```
10.0.1.0/24   → 10.0.1.0 to 10.0.1.255    (256 addresses)
10.0.0.0/16   → 10.0.0.0 to 10.0.255.255  (65536 addresses)
10.0.1.0/28   → 10.0.1.0 to 10.0.1.15     (16 addresses)
```

**Why it matters:** When designing a VPC in AWS or Azure, you're choosing CIDR ranges for your subnets. When Kubernetes assigns pod IPs, it carves them from a pod CIDR. When two services can't communicate, overlapping CIDRs are a common culprit.

---

## DNS — The Part Most Engineers Skip

DNS is the system that translates hostnames to IP addresses. Understanding it prevents a category of production issues that look mysterious until you know what's happening.

**How a DNS lookup works:**
1. Your process asks: "What's the IP for `api.example.com`?"
2. The resolver checks its local cache (respecting TTL)
3. If not cached, it queries the configured DNS server (usually your VPC's resolver)
4. The resolver queries up the hierarchy until it gets an answer

**Key concepts:**

**TTL (Time to Live)** — how long a DNS response is cached before being re-queried. If you change a DNS record and services still see the old IP, they're serving from cache. TTL expiry is the fix — not restarting the service.

```bash
# Check TTL and actual response
dig api.example.com

# Output shows TTL in seconds:
# api.example.com.  300  IN  A  10.0.1.42
#                   ^^^
#                   TTL: cached for 300 seconds
```

**ndots** — a Kubernetes-specific DNS behavior. Kubernetes appends search domains to hostnames with fewer dots than `ndots` (default: 5). `myservice` becomes `myservice.default.svc.cluster.local` before the lookup. Understanding this prevents "DNS resolution failed" debugging sessions.

**Common DNS commands:**

```bash
nslookup myservice.default.svc.cluster.local   # basic lookup
dig myservice.default.svc.cluster.local        # detailed response
dig @10.96.0.10 myservice.default.svc.cluster.local  # query specific server
# 10.96.0.10 is kube-dns in a default Kubernetes cluster
```

---

## TCP and the Connection Model

TCP is the protocol under most of your application traffic. Understanding how connections work explains a class of production problems.

**The TCP handshake:**
1. Client sends SYN
2. Server responds SYN-ACK
3. Client sends ACK — connection established

**Connection states you'll see in `ss` or `netstat`:**

```bash
ss -tulnp
# LISTEN    — waiting for connections
# ESTABLISHED — active connection
# TIME_WAIT — connection just closed, waiting to ensure last packet received
# CLOSE_WAIT — remote side closed, local side hasn't yet
```

`TIME_WAIT` sockets are normal and temporary. `CLOSE_WAIT` sockets that accumulate indicate your application isn't closing connections properly — a common bug in services that don't handle connection lifecycle correctly.

**Ports:**
- `< 1024` — privileged ports, require root (or CAP_NET_BIND_SERVICE) to bind
- `1024–49151` — registered ports (Postgres: 5432, Redis: 6379, HTTP: 8080)
- `49152–65535` — ephemeral ports, used by clients for outbound connections

**Why it matters:** "Connection refused" means nothing is listening on that port. "Connection timed out" means the packet isn't reaching the destination (firewall, security group, wrong IP). These are different problems with different fixes.

---

## Load Balancers: L4 vs L7

This distinction matters for Kubernetes ingress, service meshes, and cloud load balancer selection.

**Layer 4 (TCP/UDP) load balancer:**
- Routes based on IP and port
- Doesn't understand HTTP
- Fast, minimal overhead
- Can't do path-based routing or header manipulation
- Examples: AWS NLB, kube-proxy (default Kubernetes service routing)

**Layer 7 (HTTP/HTTPS) load balancer:**
- Routes based on HTTP content: path, headers, host header
- Can terminate TLS
- Can do canary routing, auth injection, rate limiting
- Higher overhead, but much more capable
- Examples: AWS ALB, NGINX, Envoy, Istio, Kubernetes Ingress

```
L4: client → LB → service-pod (based on IP:port only)
L7: client → LB (read HTTP) → route to /api/* or /web/* (based on path)
```

**Why it matters:** When you're configuring Kubernetes Ingress, you're using an L7 load balancer. When you set up a Kubernetes Service of type LoadBalancer, you're typically getting an L4 or L7 cloud load balancer depending on your cloud and annotations. Knowing the difference helps you choose correctly and debug routing issues.

---

## TLS — Certificates and Encryption

Every production service should be encrypted in transit. TLS is the protocol that provides this.

**How TLS works (simplified):**
1. Client connects to server, requests a TLS session
2. Server presents its certificate (which includes its public key)
3. Client verifies the certificate against trusted CAs
4. They negotiate a shared session key using asymmetric crypto
5. Subsequent communication uses symmetric encryption with the session key

**Key concepts:**

**Certificate chain** — a certificate is signed by a CA (Certificate Authority). Your server cert is signed by an intermediate CA, which is signed by a root CA that browsers and systems trust. The full chain must be presented.

**SNI (Server Name Indication)** — allows a single IP to serve multiple TLS certificates. The client includes the hostname in the TLS handshake, so the server knows which certificate to present. Essential for multi-tenant and multi-domain setups.

**Common TLS issues:**
```bash
# Inspect a certificate
openssl s_client -connect api.example.com:443 -servername api.example.com

# Check certificate expiry
echo | openssl s_client -connect api.example.com:443 2>/dev/null | \
  openssl x509 -noout -dates
```

**Why it matters:** Certificate expiry is a recurring production incident. Cert-manager in Kubernetes automates renewal, but you need to understand the underlying mechanism to configure it correctly and debug it when it fails.

---

## Kubernetes Networking Specifically

Kubernetes adds several networking layers on top of standard Linux networking.

**Pod networking:**
- Every pod gets a unique IP from the pod CIDR
- Pods can communicate directly without NAT (flat network model)
- A CNI plugin (Calico, Flannel, Cilium) implements this

**Services:**
- A stable virtual IP that load-balances across pod replicas
- Implemented by kube-proxy using iptables or IPVS rules
- `ClusterIP` — reachable only within the cluster
- `NodePort` — also exposed on every node's IP at a high port
- `LoadBalancer` — provisions a cloud load balancer

**DNS in Kubernetes:**
- kube-dns (CoreDNS) provides service discovery
- `myservice.mynamespace.svc.cluster.local` resolves to the service's ClusterIP
- Within the same namespace, just `myservice` works (due to search domains)

```bash
# From inside a pod, debug DNS
kubectl exec -it mypod -- nslookup kubernetes.default
kubectl exec -it mypod -- curl http://myservice.mynamespace/health
```

**NetworkPolicies:**
By default, all pods can talk to all other pods. NetworkPolicies restrict this:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-only-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api
```

This policy allows only pods with `app: api` to reach pods with `app: database`. Everything else is denied.

---

## Conclusion

Networking fluency is the skill that most separates DevOps engineers who can trace production issues from those who can't. DNS TTL, TCP connection states, L4 vs L7 routing, TLS certificate chains — these aren't theoretical. They appear in real incidents regularly. Build this knowledge by practicing the diagnostic commands in a real environment, and the next time a service can't reach another service, you'll know exactly where to look.

---

**Want hands-on networking labs as part of a structured DevOps curriculum?** The full curriculum is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
