---
title: "Helm Charts Explained — What They Are and How to Use Them"
categories: [devops, kubernetes]
date: 2026-04-21
image: https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80
description: Helm is Kubernetes' package manager. Here's what charts are, how templating works, and how to use Helm to manage real applications across environments.
---

# Helm Charts Explained — What They Are and How to Use Them

**Primary keyword:** Helm charts explained Kubernetes
**Secondary keywords:** what is Helm Kubernetes, Helm tutorial, Helm chart example, Kubernetes Helm deploy

---

## Introduction

Once you start managing more than a couple of applications in Kubernetes, raw YAML manifests become difficult to maintain. You have nearly identical files for dev, staging, and production — differing only in replica counts, image tags, and resource limits. When you want to install an off-the-shelf tool like Prometheus or nginx-ingress, you're looking at dozens of manifests across multiple resources. Helm solves both problems. It's the package manager for Kubernetes: bundles of pre-packaged Kubernetes resources (charts) combined with a templating engine that lets you customize them per environment.

---

## What Is a Helm Chart?

A Helm chart is a directory of files that defines a Kubernetes application. It contains:

```
mychart/
  Chart.yaml          # chart metadata: name, version, description
  values.yaml         # default configuration values
  templates/          # Kubernetes manifests with templating
    deployment.yaml
    service.yaml
    ingress.yaml
    _helpers.tpl      # reusable template snippets
  charts/             # chart dependencies (sub-charts)
```

When you run `helm install`, Helm takes your `templates/`, fills in the `values.yaml` defaults (overridden by any values you pass), and applies the rendered manifests to your cluster.

---

## Installing an Existing Chart — The Most Common Use Case

Most of the time you'll be installing community charts, not writing your own. The [Artifact Hub](https://artifacthub.io) is the central registry.

### Example: Install Prometheus Stack

```bash
# Add the Prometheus community Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install the kube-prometheus-stack chart
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Verify what got installed
kubectl get all -n monitoring
```

That one command installs Prometheus, Grafana, Alertmanager, node exporters, and kube-state-metrics — all pre-configured to work together.

### Example: Install nginx-ingress

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2
```

### Useful Helm Commands

```bash
# List installed releases
helm list -A    # all namespaces

# Get the status of a release
helm status monitoring -n monitoring

# See what values a chart exposes
helm show values prometheus-community/kube-prometheus-stack

# Upgrade a release with new values
helm upgrade monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring \
  -f my-values.yaml

# Uninstall a release
helm uninstall monitoring -n monitoring

# Roll back to a previous release revision
helm rollback monitoring 1 -n monitoring
```

---

## Customizing Charts With Values

Every chart has a `values.yaml` with defaults. You override specific values without touching the chart itself.

```bash
# See all configurable values
helm show values prometheus-community/kube-prometheus-stack | less

# Override individual values on the command line
helm install monitoring prometheus-community/kube-prometheus-stack \
  --set grafana.adminPassword=mysecretpassword \
  --set prometheus.prometheusSpec.retention=30d

# Better: override with a values file
helm install monitoring prometheus-community/kube-prometheus-stack \
  -f monitoring-values.yaml
```

```yaml
# monitoring-values.yaml
grafana:
  adminPassword: "supersecret"
  persistence:
    enabled: true
    size: 10Gi

prometheus:
  prometheusSpec:
    retention: 30d
    resources:
      requests:
        cpu: 500m
        memory: 2Gi

alertmanager:
  alertmanagerSpec:
    replicas: 2
```

**Separate values files per environment** is the standard pattern:

```bash
helm upgrade myapp ./charts/myapp \
  -f values/base.yaml \
  -f values/production.yaml   # production overrides applied last
```

---

## Writing Your Own Chart

For your own applications, writing a Helm chart gives you templated, reusable Kubernetes manifests.

### Create a Chart Skeleton

```bash
helm create myapp
```

This generates the full chart directory structure with example templates. Start by looking at `templates/deployment.yaml` and `values.yaml`.

### The Templating Syntax

Helm uses Go templates. The key patterns:

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}   # helper function from _helpers.tpl
  labels:
    {{- include "myapp.labels" . | nindent 4 }}   # include labels, indent 4 spaces
spec:
  replicas: {{ .Values.replicaCount }}     # value from values.yaml
  selector:
    matchLabels:
      app: {{ .Values.app.name }}
  template:
    metadata:
      labels:
        app: {{ .Values.app.name }}
    spec:
      containers:
      - name: {{ .Chart.Name }}            # from Chart.yaml
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        ports:
        - containerPort: {{ .Values.service.port }}
        {{- if .Values.resources }}        # conditional block
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
        {{- end }}
```

```yaml
# values.yaml
replicaCount: 2

app:
  name: myapp

image:
  repository: myapp
  tag: ""   # defaults to Chart.AppVersion if empty

service:
  port: 8080

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

### Validate Your Templates

```bash
# Render templates locally without installing
helm template myapp ./charts/myapp -f values/production.yaml

# Check for errors
helm lint ./charts/myapp

# Dry run against a cluster (shows what would be applied)
helm install myapp ./charts/myapp --dry-run --debug
```

---

## Chart Dependencies

Your application often depends on other charts (a database, a cache). Define dependencies in `Chart.yaml`:

```yaml
# Chart.yaml
apiVersion: v2
name: myapp
version: 1.0.0
appVersion: "2.3.1"

dependencies:
- name: postgresql
  version: "13.2.0"
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled   # can be disabled via values
```

```bash
# Download dependencies
helm dependency update ./charts/myapp

# Install with dependencies
helm install myapp ./charts/myapp \
  --set postgresql.enabled=true \
  --set postgresql.auth.password=mysecretpassword
```

---

## Helm in a GitOps Workflow

Helm and GitOps (ArgoCD or Flux) work together naturally. ArgoCD can deploy a Helm chart from your Git repository, using values files stored alongside the chart.

```yaml
# ArgoCD Application using a Helm chart
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
spec:
  source:
    repoURL: https://github.com/myorg/platform-config
    path: charts/myapp
    targetRevision: HEAD
    helm:
      valueFiles:
      - values/base.yaml
      - values/production.yaml
  destination:
    namespace: production
    server: https://kubernetes.default.svc
```

Any change to the values files in Git automatically triggers a new Helm deployment through ArgoCD — no manual `helm upgrade` needed.

---

## Conclusion

Helm solves two real problems: installing complex off-the-shelf tools (Prometheus, ingress controllers, cert-manager) with a single command, and managing your own applications across environments without duplicating manifests. Start by installing community charts — the hands-on practice of reading `values.yaml` and overriding specific values is the fastest way to understand how charts work. Then write a chart for one of your own apps. Once you have both, adding ArgoCD to manage Helm releases from Git is the natural final step.

---

**Want to build Helm and GitOps skills through structured labs?** The full curriculum is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
