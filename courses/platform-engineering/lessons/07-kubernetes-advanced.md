---
layout: lesson
permalink: /courses/platform-engineering/lessons/07-kubernetes-advanced/
title: Kubernetes Advanced Platform
description: Go beyond the basics with Helm chart authoring, KEDA event-driven autoscaling, custom operators, and advanced scheduling — the building blocks of a self-service platform.
lesson_number: 7
duration: 60 min
section_number: 4
section_title: "Advanced Kubernetes & GitOps"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Helm, KEDA, Operators, Scheduling]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/06-kubernetes-fundamentals/
prev_lesson_title: "Kubernetes Fundamentals"
next_lesson:
next_lesson_title:
---

## What You Will Learn

- Author production-quality Helm charts with best-practice templating
- Configure KEDA for event-driven autoscaling beyond CPU/memory
- Understand when and how to write custom operators
- Use node affinity, taints, and tolerations for workload placement
- Implement Pod Disruption Budgets for high-availability guarantees

---

## 1. Helm — The Package Manager for Kubernetes

Helm bundles Kubernetes manifests into reusable, versioned packages called **charts**.

### Chart structure

```
my-service/
├── Chart.yaml          # Chart metadata (name, version, dependencies)
├── values.yaml         # Default configuration values
├── values-prod.yaml    # Production overrides
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── configmap.yaml
│   └── _helpers.tpl    # Reusable template fragments
└── charts/             # Chart dependencies (subcharts)
```

### Templating best practices

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-service.fullname" . }}
  labels:
    {{- include "my-service.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  {{- if .Values.autoscaling.enabled }}
  # HPA manages replicas — don't set a fixed count
  {{- end }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

```yaml
# values.yaml
replicaCount: 2

image:
  repository: ghcr.io/myorg/my-service
  tag: ""          # defaults to Chart.AppVersion

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
```

---

## 2. KEDA — Event-Driven Autoscaling

HPA scales on CPU/memory. KEDA scales on **any metric** — queue depth, HTTP request rate, database row count, Prometheus queries.

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-scaler
spec:
  scaleTargetRef:
    name: order-processor
  minReplicaCount: 0           # scale to zero when idle!
  maxReplicaCount: 50
  triggers:
    # Scale based on SQS queue depth
    - type: aws-sqs-queue
      metadata:
        queueURL: https://sqs.eu-west-1.amazonaws.com/123/order-queue
        queueLength: "10"      # 1 replica per 10 messages
        awsRegion: eu-west-1

    # Scale based on Prometheus metric
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        metricName: http_requests_pending
        query: sum(http_requests_pending{app="order-processor"})
        threshold: "100"
```

<div class="callout callout--info">
  <span class="callout-icon">📌</span>
  <div class="callout-body">
    <strong>Scale-to-zero saves real money</strong>
    Batch processing workers that are idle 80% of the time can scale to zero with KEDA. On a 10-node cluster, scaling 20 idle workers to zero can free 4+ nodes.
  </div>
</div>

---

## 3. Custom Operators

When you find yourself manually doing the same Kubernetes operations repeatedly, write an operator to automate it.

### What operators do

```
Human operator:                  Kubernetes operator:
1. Check app is healthy    →     Controller watches CRD
2. Take backup before       →    Reconcile loop runs
   upgrading               →    on every change
3. Apply schema migration   →
4. Rolling restart pods     →    Automated, auditable,
5. Monitor rollout          →    tested, repeatable
```

### When to write an operator

Write an operator when:
- You're managing **stateful** workloads (databases, message queues)
- You need **domain-specific rollout logic** beyond what Deployments offer
- You want to expose a simplified CRD API to application teams

Use tools like **Operator SDK** or **Kubebuilder** — don't write the controller scaffolding by hand.

---

## 4. Workload Placement

### Node affinity — prefer or require specific nodes

```yaml
spec:
  affinity:
    nodeAffinity:
      # Hard requirement
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: node-type
                operator: In
                values: [gpu]
      # Soft preference
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 80
          preference:
            matchExpressions:
              - key: region
                operator: In
                values: [eu-west-1a]
```

### Taints & tolerations — dedicated node pools

```bash
# Taint a node — only pods that tolerate it will be scheduled here
kubectl taint nodes node-pool-gpu dedicated=gpu:NoSchedule
```

```yaml
# Pod toleration — this pod can run on the tainted node
tolerations:
  - key: dedicated
    operator: Equal
    value: gpu
    effect: NoSchedule
```

---

## 5. Pod Disruption Budgets

Prevent Kubernetes from evicting too many pods at once during node drains or cluster upgrades.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-service-pdb
spec:
  selector:
    matchLabels:
      app: api-service
  minAvailable: 2    # always keep at least 2 pods running
  # OR:
  # maxUnavailable: 1    # allow at most 1 pod to be unavailable
```

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>PDBs without HPA can block cluster upgrades</strong>
    If <code>minAvailable: 2</code> but you only have 2 replicas, a node drain will be blocked. Ensure <code>minAvailable &lt; replicas</code>, and keep replicas ≥ 3 for critical services.
  </div>
</div>

---

## 6. Hands-on Exercise

1. Create a Helm chart for a simple web service with configurable replicas, resources, and ingress
2. Add a `_helpers.tpl` with standard labels (`app.kubernetes.io/name`, `version`, `managed-by`)
3. Install KEDA and create a `ScaledObject` that scales a worker deployment based on a Redis list length
4. Add a `PodDisruptionBudget` and test it by draining a node (`kubectl drain --ignore-daemonsets`)
5. Use node affinity to ensure your database pod lands on a node with SSD storage (`node-type=ssd`)

---

## Summary

| Concept    | Key takeaway                                                              |
|------------|---------------------------------------------------------------------------|
| Helm       | Charts = versioned, templated K8s manifests — use `_helpers.tpl` for DRY |
| KEDA       | Scale on anything — queue depth, DB rows, custom Prometheus metrics       |
| Operators  | Automate complex stateful operations — use Operator SDK, not raw controllers |
| Affinity   | `required` for hard rules, `preferred` for soft preferences               |
| PDB        | Always add a PDB for critical services — prevents unsafe eviction         |
