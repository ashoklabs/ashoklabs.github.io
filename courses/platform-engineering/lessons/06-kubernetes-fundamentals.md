---
layout: lesson
permalink: /courses/platform-engineering/lessons/06-kubernetes-fundamentals/
title: Kubernetes Fundamentals
description: Master the core Kubernetes building blocks — Pods, Deployments, Services, Ingress, ConfigMaps, resource management, and the control plane internals every platform engineer must understand.
lesson_number: 6
duration: 60 min
section_number: 3
section_title: "Infrastructure & Kubernetes"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Kubernetes, K8s, Deployments, Services]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/05-infrastructure-as-code/
prev_lesson_title: "Infrastructure as Code"
next_lesson: /courses/platform-engineering/lessons/07-kubernetes-advanced/
next_lesson_title: "Kubernetes Advanced Platform"
---

## What You Will Learn

- Understand the Kubernetes control plane and node architecture
- Write production-ready Deployment, Service, and Ingress manifests
- Configure resource requests, limits, and quality of service classes
- Use ConfigMaps and Secrets correctly
- Set up liveness, readiness, and startup probes
- Scale workloads with HPA and understand scheduler behaviour

---

## 1. Architecture Overview

```
┌─────────────────── Control Plane ───────────────────┐
│                                                      │
│  API Server ──→ etcd (state)                        │
│       │                                              │
│  Scheduler ──→ assigns Pods to Nodes                │
│  Controller Manager ──→ reconciles desired state    │
│  Cloud Controller ──→ cloud resources (LB, disks)  │
└──────────────────────────────────────────────────────┘
         │
         │ kubelet (watches API Server)
         ▼
┌──── Worker Node ────┐
│  kubelet            │
│  kube-proxy         │
│  container runtime  │
│  ┌────┐ ┌────┐      │
│  │Pod │ │Pod │      │
│  └────┘ └────┘      │
└─────────────────────┘
```

The **API Server** is the single entry point. Everything reads from and writes to it. `kubectl` is just an API client.

---

## 2. Deployments

A Deployment manages ReplicaSets, which manage Pods. You rarely interact with ReplicaSets directly.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # allow 1 extra pod during rollout
      maxUnavailable: 0    # never reduce below desired count
  template:
    metadata:
      labels:
        app: api-service
        version: v1.2.0
    spec:
      containers:
        - name: api
          image: ghcr.io/myorg/api-service:v1.2.0
          ports:
            - containerPort: 3000

          # Resource management (required in production)
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          # Health checks
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15

          readinessProbe:
            httpGet:
              path: /readyz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

          # Graceful shutdown
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sleep", "5"]
          terminationGracePeriodSeconds: 30
```

---

## 3. Services & Ingress

### Services — stable network identity

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: production
spec:
  selector:
    app: api-service     # matches Deployment's pod labels
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP        # internal only — use Ingress for external traffic
```

| Service Type   | Use case                                        |
|----------------|-------------------------------------------------|
| `ClusterIP`    | Internal traffic between services               |
| `NodePort`     | Dev/testing — exposed on every node's IP:port   |
| `LoadBalancer` | Direct cloud load balancer (expensive at scale) |

### Ingress — HTTP routing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.myapp.com]
      secretName: api-tls-cert
  rules:
    - host: api.myapp.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
```

<div class="callout callout--tip">
  <span class="callout-icon">💡</span>
  <div class="callout-body">
    <strong>One LoadBalancer, many services</strong>
    Use a single Ingress controller (nginx or Traefik) as your cluster's entry point, then route to different services via host/path rules. This is far cheaper than one LoadBalancer per service.
  </div>
</div>

---

## 4. ConfigMaps & Secrets

```yaml
# ConfigMap — non-sensitive configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  LOG_LEVEL: "info"
  FEATURE_FLAG_NEW_UI: "true"
  DATABASE_HOST: "postgres.production.svc.cluster.local"
```

```yaml
# Use in a Deployment
envFrom:
  - configMapRef:
      name: api-config
  - secretRef:
      name: api-secrets     # DATABASE_PASSWORD, API_KEY, etc.
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>Secrets are not encrypted by default</strong>
    Kubernetes Secrets are base64-encoded, not encrypted. Enable <strong>Encryption at Rest</strong> or use an external secret manager (HashiCorp Vault, AWS Secrets Manager) for production credentials.
  </div>
</div>

---

## 5. Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70     # scale up when avg CPU > 70%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## 6. Hands-on Exercise

1. Deploy a simple web app with 3 replicas, resource limits, and health probes
2. Expose it via a ClusterIP Service and an Ingress rule on a test hostname
3. Trigger a rolling update by changing the image tag — watch `kubectl rollout status`
4. Deliberately make a readiness probe fail and observe how the Deployment pauses
5. Configure an HPA and generate load with `k6` — watch the replica count increase

---

## Summary

| Concept       | Key takeaway                                                          |
|---------------|-----------------------------------------------------------------------|
| Control plane | API Server is the single source of truth; everything goes through it  |
| Deployment    | Manages rolling updates; always set `maxUnavailable: 0` for zero-downtime |
| Service       | Stable DNS name for a set of Pods — use ClusterIP + Ingress over LoadBalancer |
| Resources     | Always set requests AND limits — missing limits = eviction risk        |
| HPA           | Scale on CPU/memory utilization; set min replicas ≥ 2 for HA          |
