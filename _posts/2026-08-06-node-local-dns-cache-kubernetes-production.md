---
title: "NodeLocal DNSCache in Kubernetes: Production Setup, kind Demo, and Prometheus Metrics"
categories: [kubernetes, devops]
date: 2026-08-06
image: https://i.imghippo.com/files/kJjh9491IxA.png
description: Cut Kubernetes DNS latency and reduce CoreDNS load with NodeLocal DNSCache. Includes a runnable kind cluster, Prometheus scraping, Grafana queries, and a safe production rollout plan.
---

# NodeLocal DNSCache in Kubernetes: Production Setup, kind Demo, and Prometheus Metrics

**Meta description:** Learn how to deploy NodeLocal DNSCache in Kubernetes, prove its value with before-and-after Prometheus metrics, and validate it safely in a local kind cluster before production.

**Primary keyword:** Kubernetes NodeLocal DNSCache
**Secondary keywords:** node-local-dns, CoreDNS metrics, Kubernetes DNS performance, Prometheus Grafana Kubernetes

---

## Introduction

DNS is easy to overlook in Kubernetes—until a deployment starts failing with `no such host`, or a busy application suddenly spends more time waiting on name lookups than doing useful work.

Normally, every Pod sends its DNS queries to the `kube-dns` Service. That request may cross nodes before it reaches a CoreDNS Pod. It works well for many clusters, but repeated DNS lookups can create unnecessary load on CoreDNS and make DNS one more shared dependency during a traffic spike.

**NodeLocal DNSCache** runs a DNS cache on every node. Pods ask that local cache first. A cache hit is answered on the same node; a cache miss goes to CoreDNS or the upstream resolver. The result is usually lower lookup latency and much less repeated traffic reaching CoreDNS.

This guide builds the pattern in a disposable **kind** cluster, scrapes its metrics with **Prometheus**, and shows exactly what to compare in **Grafana** before and after enabling it.

---

## What Actually Changes

Before NodeLocal DNSCache:

```text
Pod -> kube-dns Service -> CoreDNS Pod -> upstream DNS (when needed)
```

After NodeLocal DNSCache:

```text
Pod -> local DNS cache (169.254.20.10) -> CoreDNS Service / upstream DNS
```

| Concern | CoreDNS Service only | With NodeLocal DNSCache |
|---|---|---|
| Repeated lookups | Reach CoreDNS every time | Usually answered on the node |
| CoreDNS load | Includes every Pod query | Mostly cache misses |
| DNS network path | Uses the Service network | Common path stays local |
| Failure scope | Shared DNS path is busy for everyone | Nodes keep a local cache for common names |

The critical point is that the DaemonSet alone does not turn the feature on. Pods must be configured to use the local IP as their nameserver. In Kubernetes, that normally means changing the kubelet `clusterDNS` setting and recreating workloads so their `/etc/resolv.conf` is updated.

---

## When It Is Worth It

NodeLocal DNSCache is especially useful when you have many Pods per node, DNS-heavy services, short-lived connections, large rollouts, or intermittent CoreDNS saturation. It will not fix a broken upstream resolver, a bad CoreDNS configuration, or an application that generates a unique hostname for every request.

Measure first. Then make the change with a small canary and verify the expected result: NodeLocal cache traffic rises, CoreDNS traffic falls, and errors stay close to zero.

---

## 1. Create a Baseline kind Cluster

Install the local tools if needed:

```bash
brew install kind kubectl helm
```

Create `kind-baseline.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

Create the cluster and check the CoreDNS Service IP:

```bash
kind create cluster --name dns-baseline --config kind-baseline.yaml
kubectl get service kube-dns -n kube-system
```

On a default kind cluster the Service IP is normally `10.96.0.10`. Verify it in your own cluster; that address becomes the upstream target for the node-local cache.

Install Prometheus and Grafana using the community stack:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

Create some repeatable DNS traffic. Save this as `dns-load.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dns-load
  namespace: default
spec:
  replicas: 6
  selector:
    matchLabels:
      app: dns-load
  template:
    metadata:
      labels:
        app: dns-load
    spec:
      containers:
        - name: dns-load
          image: busybox:1.36
          command: ["/bin/sh", "-c"]
          args:
            - |
              while true; do
                nslookup kubernetes.default.svc.cluster.local >/dev/null 2>&1
                nslookup www.example.com >/dev/null 2>&1
              done
```

```bash
kubectl apply -f dns-load.yaml
kubectl rollout status deployment/dns-load
```

Open Grafana locally:

```bash
kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3000:80
kubectl -n monitoring get secret kube-prometheus-stack-grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode; echo
```

Sign in at `http://localhost:3000` as `admin`, then use Grafana Explore to capture this baseline CoreDNS request rate:

```promql
sum(rate(coredns_dns_requests_total{namespace="kube-system",pod=~"coredns-.*"}[5m]))
```

Let the traffic run for several minutes. Use an equivalent traffic window after enablement; a before-and-after comparison is only useful when the workload is comparable.

---

## 2. Create a kind Cluster With the Local DNS IP

For the NodeLocal version, create nodes whose kubelets hand Pods the local DNS address. We use `169.254.20.10`, which is a common choice. In production, first confirm that the address is not used by your node interfaces, Pod CIDR, Service CIDR, or host routes.

Create `kind-nodelocal.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  serviceSubnet: "10.96.0.0/16"
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            cluster-dns: 169.254.20.10
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            cluster-dns: 169.254.20.10
  - role: worker
    kubeadmConfigPatches:
      - |
        kind: JoinConfiguration
        nodeRegistration:
          kubeletExtraArgs:
            cluster-dns: 169.254.20.10
```

```bash
kind create cluster --name dns-nodelocal --config kind-nodelocal.yaml
kubectl config use-context kind-dns-nodelocal
kubectl get service kube-dns -n kube-system -o wide
```

If `kube-dns` does not have ClusterIP `10.96.0.10`, replace that address in the following Corefile with the actual value.

---

## 3. Deploy NodeLocal DNSCache and Its Metrics Endpoint

Create `nodelocaldns.yaml`. This is a clear kind-friendly manifest; for production, begin with the NodeLocal DNSCache manifest supported by your Kubernetes distribution and keep your changes in Git.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: node-local-dns
  namespace: kube-system
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: node-local-dns
  namespace: kube-system
data:
  Corefile: |
    cluster.local:53 {
        errors
        cache {
            success 9984 30
            denial 9984 5
        }
        reload
        loop
        bind 169.254.20.10 10.96.0.10
        forward . 10.96.0.10 {
            force_tcp
        }
        prometheus :9253
        health 169.254.20.10:8080
    }
    in-addr.arpa:53 {
        errors
        cache 30
        reload
        loop
        bind 169.254.20.10 10.96.0.10
        forward . 10.96.0.10 { force_tcp }
        prometheus :9253
    }
    ip6.arpa:53 {
        errors
        cache 30
        reload
        loop
        bind 169.254.20.10 10.96.0.10
        forward . 10.96.0.10 { force_tcp }
        prometheus :9253
    }
    .:53 {
        errors
        cache 30
        reload
        loop
        bind 169.254.20.10 10.96.0.10
        forward . /etc/resolv.conf { force_tcp }
        prometheus :9253
    }
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-local-dns
  namespace: kube-system
  labels:
    k8s-app: node-local-dns
spec:
  selector:
    matchLabels:
      k8s-app: node-local-dns
  template:
    metadata:
      labels:
        k8s-app: node-local-dns
    spec:
      serviceAccountName: node-local-dns
      hostNetwork: true
      dnsPolicy: Default
      priorityClassName: system-node-critical
      tolerations:
        - operator: Exists
      containers:
        - name: node-cache
          image: registry.k8s.io/dns/k8s-dns-node-cache:1.24.0
          args: ["-localip", "169.254.20.10", "-conf", "/etc/Corefile", "-upstreamsvc", "kube-dns"]
          securityContext:
            capabilities:
              add: ["NET_ADMIN"]
          ports:
            - name: dns
              containerPort: 53
              protocol: UDP
            - name: dns-tcp
              containerPort: 53
              protocol: TCP
            - name: metrics
              containerPort: 9253
              protocol: TCP
          livenessProbe:
            httpGet:
              host: 169.254.20.10
              path: /health
              port: 8080
            initialDelaySeconds: 10
          volumeMounts:
            - name: config-volume
              mountPath: /etc/coredns
              readOnly: true
            - name: xtables-lock
              mountPath: /run/xtables.lock
      volumes:
        - name: config-volume
          configMap:
            name: node-local-dns
            items:
              - key: Corefile
                path: Corefile.base
        - name: xtables-lock
          hostPath:
            path: /run/xtables.lock
            type: FileOrCreate
---
apiVersion: v1
kind: Service
metadata:
  name: node-local-dns-metrics
  namespace: kube-system
  labels:
    k8s-app: node-local-dns
spec:
  selector:
    k8s-app: node-local-dns
  ports:
    - name: metrics
      port: 9253
      targetPort: metrics
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: node-local-dns
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames: ["kube-system"]
  selector:
    matchLabels:
      k8s-app: node-local-dns
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
```

Apply it and wait for one cache Pod per node:

```bash
kubectl apply -f nodelocaldns.yaml
kubectl rollout status daemonset/node-local-dns -n kube-system --timeout=3m
kubectl get pods -n kube-system -l k8s-app=node-local-dns -o wide
```

The cache container converts `Corefile.base` into the active configuration and sets up the node-level rules it needs. The host network and the daemon-per-node model are essential; this is not a regular CoreDNS Deployment.

---

## 4. Confirm Pods Are Using the Cache

Create a new Pod and inspect its resolver configuration:

```bash
kubectl run dns-check --image=busybox:1.36 --restart=Never --command -- sh -c \
  'cat /etc/resolv.conf; nslookup kubernetes.default.svc.cluster.local; sleep 3600'

kubectl logs dns-check
```

The `nameserver` line should show `169.254.20.10`. If it still shows `10.96.0.10`, do not continue as though the cache is enabled. Fix the kubelet configuration first.

Deploy the same `dns-load.yaml` workload in this cluster and let it reach a steady state.

---

## 5. Prometheus and Grafana: The Before-and-After Metrics

In Prometheus Targets, confirm that the `node-local-dns` ServiceMonitor has one healthy target for each node. Then build a Grafana dashboard with these panels.

| Panel | PromQL | Expected result |
|---|---|---|
| CoreDNS requests/second | `sum(rate(coredns_dns_requests_total{namespace="kube-system",pod=~"coredns-.*"}[5m]))` | Lower after enablement for equivalent traffic |
| NodeLocal requests/second | `sum(rate(coredns_dns_requests_total{namespace="kube-system",pod=~"node-local-dns-.*"}[5m]))` | Matches DNS traffic created by Pods |
| Cache hit ratio | `sum(rate(coredns_cache_hits_total{namespace="kube-system",pod=~"node-local-dns-.*"}[5m])) / sum(rate(coredns_cache_requests_total{namespace="kube-system",pod=~"node-local-dns-.*"}[5m]))` | Rises for repeated names |
| NodeLocal p99 duration | `histogram_quantile(0.99, sum by (le) (rate(coredns_dns_request_duration_seconds_bucket{namespace="kube-system",pod=~"node-local-dns-.*"}[5m])))` | Low and stable |
| DNS server errors | `sum(rate(coredns_dns_responses_total{namespace="kube-system",rcode=~"SERVFAIL|REFUSED"}[5m]))` | Near zero |

Some chart versions attach different labels. If a query returns no data, start by running `coredns_dns_requests_total` in Prometheus, inspect a returned time series, then adjust the `pod` or `job` selector. Keep the selectors specific: both cluster CoreDNS and NodeLocal DNSCache export CoreDNS-style metrics.

The simple result you are looking for is:

```text
CoreDNS request reduction = 1 - (CoreDNS requests after / CoreDNS requests before)
```

Annotate the exact enablement time on the Grafana dashboard. It makes a change review far easier than trying to remember when a DaemonSet was rolled out.

---

## Production Rollout Plan

The local lab is intentionally disposable. A production rollout should be gradual:

1. Record current CoreDNS QPS, p95/p99 latency, error codes, CPU and memory, and DNS-related application failures.
2. Validate the chosen local address against node routes and every cluster network range.
3. Deploy NodeLocal DNSCache to all intended nodes first, but leave kubelet DNS unchanged. Confirm the DaemonSet is healthy and metrics are being scraped.
4. Change `clusterDNS` using the supported method for your platform. Managed Kubernetes services may require a new node pool or node-group rollout.
5. Canary a low-risk node pool. Drain one node at a time so recreated Pods receive the new resolver.
6. Test internal Service names, external names, and critical application paths. Watch the Grafana panels throughout.
7. Roll out in batches only after the canary is stable.

Two practical details matter:

- **Negative caching can delay visibility of a newly created record.** This example keeps denial caching at five seconds.
- **TTL and cache capacity are policy choices.** Longer caching can reduce queries but can also keep an unwanted answer around longer. Start conservatively and tune from real traffic.

### Rollback

Rollback means restoring kubelet `clusterDNS` to the CoreDNS Service IP and recreating the affected Pods. Do that before removing the DaemonSet. Deleting NodeLocal DNSCache first would leave Pods pointing at an address with no DNS listener.

---

## Troubleshooting

Start with these checks:

```bash
# One cache Pod per node?
kubectl get daemonset node-local-dns -n kube-system

# Did the cache start correctly?
kubectl logs -n kube-system daemonset/node-local-dns -c node-cache --tail=100

# Does a new Pod get the local nameserver?
kubectl exec dns-check -- cat /etc/resolv.conf

# Can it resolve both internal and external names?
kubectl exec dns-check -- nslookup kubernetes.default.svc.cluster.local
kubectl exec dns-check -- nslookup www.example.com
```

If external names fail, inspect the `.:53` forwarder and the resolver available from the node network. If Service names fail, check the `kube-dns` ClusterIP in the Corefile. If the DaemonSet cannot start, compare the manifest with the version supported by your Kubernetes distribution—IPVS, container runtime, and node security settings can require provider-specific handling.

---

## Final Takeaway

NodeLocal DNSCache is a small Kubernetes change with a meaningful benefit on DNS-heavy clusters: repeated lookups stay local, CoreDNS handles fewer requests, and DNS becomes less sensitive to network pressure.

The real value is not just enabling it. It is proving the impact. Capture a baseline, use the same traffic after the change, and let Prometheus and Grafana show whether CoreDNS load fell while DNS latency and error rates stayed healthy.
