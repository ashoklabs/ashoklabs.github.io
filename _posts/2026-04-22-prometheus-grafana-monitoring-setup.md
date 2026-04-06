---
title: "Prometheus and Grafana — Setting Up Monitoring From Scratch"
categories: [devops, observability]
date: 2026-04-22
image: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80
description: A hands-on guide to setting up Prometheus and Grafana on Kubernetes — metrics collection, dashboards, and alert rules that actually fire when something breaks.
---

# Prometheus and Grafana — Setting Up Monitoring From Scratch

**Primary keyword:** Prometheus Grafana Kubernetes setup
**Secondary keywords:** Prometheus tutorial, Grafana dashboard Kubernetes, monitoring DevOps setup, observability Kubernetes

---

## Introduction

You can't operate what you can't observe. Prometheus and Grafana are the standard open-source monitoring stack in Kubernetes environments, and for good reason: Prometheus is excellent at collecting and querying metrics, and Grafana turns those metrics into dashboards that make patterns visible at a glance. This guide walks through setting up both from scratch on a Kubernetes cluster and building monitoring that's actually useful — not just pretty, but actionable.

---

## The Monitoring Stack: What Each Tool Does

**Prometheus** — time-series database and collection engine. It scrapes metrics from your applications and infrastructure on a regular interval (typically every 15-30 seconds). Every metric has a name, labels, and a timestamp. You query metrics using PromQL (Prometheus Query Language).

**Grafana** — visualization layer. It reads from Prometheus (and many other data sources) and renders dashboards. You define panels with PromQL queries, and Grafana draws the graphs.

**Alertmanager** — part of the Prometheus ecosystem. Evaluates alert rules you define, deduplicates and groups firing alerts, and routes them to notification channels (Slack, PagerDuty, email).

**kube-state-metrics** — exports Kubernetes object state as metrics. Pod counts, deployment replica status, node conditions — the metrics that tell you about the health of your cluster.

---

## Installation: kube-prometheus-stack Helm Chart

The easiest way to get the full stack running is the `kube-prometheus-stack` chart, which installs Prometheus Operator, Prometheus, Grafana, Alertmanager, and node exporters in one shot.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create values file
cat <<EOF > monitoring-values.yaml
grafana:
  adminPassword: "changethis"
  persistence:
    enabled: true
    size: 5Gi

prometheus:
  prometheusSpec:
    retention: 15d
    resources:
      requests:
        cpu: 500m
        memory: 2Gi
      limits:
        memory: 4Gi
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 20Gi

alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 5Gi
EOF

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  -f monitoring-values.yaml
```

```bash
# Verify everything is running
kubectl get pods -n monitoring

# Access Grafana locally
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
# Open http://localhost:3000
# Username: admin, Password: changethis
```

---

## Exposing Metrics From Your Application

Prometheus scrapes metrics from HTTP endpoints that expose them in a specific format. Your application needs to expose a `/metrics` endpoint.

### Python (Flask) Example

```python
from flask import Flask
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

app = Flask(__name__)

# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)
REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/users')
def get_users():
    start = time.time()
    # ... your logic
    REQUEST_COUNT.labels(method='GET', endpoint='/api/users', status='200').inc()
    REQUEST_LATENCY.labels(method='GET', endpoint='/api/users').observe(time.time() - start)
    return {"users": []}
```

### Tell Prometheus to Scrape Your App

```yaml
# ServiceMonitor — tells Prometheus Operator to scrape your service
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  namespace: production
  labels:
    release: monitoring   # must match the Prometheus Operator selector
spec:
  selector:
    matchLabels:
      app: myapp
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

Apply this and Prometheus automatically discovers and scrapes your service — no Prometheus config file editing required.

---

## Writing PromQL Queries

PromQL is the query language for Prometheus. You use it to build Grafana panels and alert rules.

### Basic Query Patterns

```promql
# Request rate over the last 5 minutes (per second)
rate(http_requests_total[5m])

# Error rate (5xx responses) as a percentage
rate(http_requests_total{status=~"5.."}[5m])
  / rate(http_requests_total[5m]) * 100

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage by pod
rate(container_cpu_usage_seconds_total{namespace="production"}[5m])

# Memory usage
container_memory_working_set_bytes{namespace="production"}

# Pod restarts in the last hour
increase(kube_pod_container_status_restarts_total{namespace="production"}[1h])

# Number of pods not in Running state
count(kube_pod_status_phase{namespace="production", phase!="Running"})
```

Test these in Grafana's Explore view (the compass icon) before building dashboard panels.

---

## Building a Useful Grafana Dashboard

The most useful application dashboard covers four signals: request rate, error rate, latency, and saturation (the USE/RED method).

### Create a Dashboard

In Grafana: + → Dashboard → Add panel.

**Panel 1: Request Rate**
```promql
sum(rate(http_requests_total{namespace="production"}[5m])) by (endpoint)
```
Visualization: Time series. Shows traffic patterns per endpoint.

**Panel 2: Error Rate (%)**
```promql
sum(rate(http_requests_total{namespace="production", status=~"5.."}[5m]))
/ sum(rate(http_requests_total{namespace="production"}[5m])) * 100
```
Visualization: Gauge or Time series. Add a threshold at 1% (yellow) and 5% (red).

**Panel 3: P95 Latency**
```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket{namespace="production"}[5m])) by (le, endpoint)
)
```
Visualization: Time series. Add a threshold at your SLO (e.g., 500ms).

**Panel 4: Pod Restart Count**
```promql
sum(increase(kube_pod_container_status_restarts_total{namespace="production"}[1h])) by (pod)
```
Visualization: Bar chart. Any non-zero value is worth investigating.

Save the dashboard and set it as the team's default view for your namespace.

---

## Setting Up Alert Rules

Alert on symptoms, not causes. Instead of "CPU is above 80%", alert on "error rate is above 1%" or "P95 latency is above 500ms."

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: myapp-alerts
  namespace: production
  labels:
    release: monitoring
spec:
  groups:
  - name: myapp
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        sum(rate(http_requests_total{namespace="production", status=~"5.."}[5m]))
        / sum(rate(http_requests_total{namespace="production"}[5m])) > 0.01
      for: 2m   # must be true for 2 minutes before firing
      labels:
        severity: critical
      annotations:
        summary: "High error rate in production"
        description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

    - alert: SlowResponses
      expr: |
        histogram_quantile(0.95,
          sum(rate(http_request_duration_seconds_bucket{namespace="production"}[5m])) by (le)
        ) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "P95 latency above 500ms"
        description: "P95 latency is {{ $value | humanizeDuration }}"

    - alert: PodCrashLooping
      expr: |
        rate(kube_pod_container_status_restarts_total{namespace="production"}[15m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod {{ $labels.pod }} is crash looping"
```

---

## Configuring Alertmanager for Slack Notifications

```yaml
# In your monitoring-values.yaml
alertmanager:
  config:
    global:
      slack_api_url: "https://hooks.slack.com/services/..."
    route:
      group_by: ['alertname', 'namespace']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: 'slack-critical'
      routes:
      - match:
          severity: warning
        receiver: 'slack-warnings'
    receivers:
    - name: 'slack-critical'
      slack_configs:
      - channel: '#alerts-critical'
        title: '{{ .CommonAnnotations.summary }}'
        text: '{{ .CommonAnnotations.description }}'
        send_resolved: true
    - name: 'slack-warnings'
      slack_configs:
      - channel: '#alerts-warnings'
        title: '{{ .CommonAnnotations.summary }}'
        send_resolved: true
```

Apply with `helm upgrade monitoring ... -f monitoring-values.yaml`.

---

## Conclusion

The difference between a team that discovers incidents from customer reports and one that catches them internally is a monitoring stack that alerts on the right signals. Start with the kube-prometheus-stack Helm chart to get Prometheus and Grafana running quickly, instrument your application to expose metrics, build the four RED method panels in Grafana, and set alert rules on error rate and latency. That's enough to catch the majority of production issues before they become customer-visible outages.

---

**Want to build observability skills as part of a structured platform engineering curriculum?** The full curriculum is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
