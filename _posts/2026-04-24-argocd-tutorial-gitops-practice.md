---
title: "ArgoCD Tutorial — GitOps in Practice From Zero to Running"
categories: [gitops, devops, kubernetes]
date: 2026-04-24
image: https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&q=80
description: A hands-on ArgoCD tutorial that sets up a complete GitOps workflow — install ArgoCD, connect a repository, deploy an app, and enable self-healing reconciliation.
---

# ArgoCD Tutorial — GitOps in Practice From Zero to Running

**Primary keyword:** ArgoCD tutorial GitOps
**Secondary keywords:** ArgoCD beginners guide, install ArgoCD Kubernetes, GitOps ArgoCD example

---

## Introduction

ArgoCD is the most widely adopted GitOps operator for Kubernetes. It watches a Git repository and continuously syncs your cluster to match what's declared there — no manual `kubectl apply`, no deployment scripts, no SSH into servers. Any change to your Kubernetes manifests in Git automatically triggers a reconciliation. Any manual change to the cluster gets reverted. Git is the single source of truth. This tutorial walks through setting up ArgoCD from scratch and building a complete GitOps workflow.

---

## How ArgoCD Works

ArgoCD runs inside your Kubernetes cluster and continuously compares two things:

**Desired state** — what's in your Git repository (Kubernetes manifests, Helm charts, Kustomize overlays)
**Actual state** — what's currently running in the cluster

If they differ, ArgoCD reconciles by applying the desired state from Git. With `selfHeal: true`, it also reverts any manual changes made directly to the cluster.

```
Git Repository                 ArgoCD                    Kubernetes Cluster
(desired state)     →→→    (reconciler)     →→→         (actual state)
                                ↑↓
                        Continuous comparison
                        Auto-sync on drift
```

---

## Step 1: Install ArgoCD

```bash
# Create the argocd namespace and install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=120s

# Verify
kubectl get pods -n argocd
```

### Access the ArgoCD UI

```bash
# Port-forward the ArgoCD API server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

Open `https://localhost:8080` (accept the self-signed cert), log in with `admin` and the password above.

### Install the ArgoCD CLI

```bash
# macOS
brew install argocd

# Log in via CLI
argocd login localhost:8080 --username admin --password <password> --insecure

# Change the default password
argocd account update-password
```

---

## Step 2: Set Up Your GitOps Repository

Create a Git repository for your cluster configuration. Keep it separate from your application code — this is your **platform config repo**.

```
platform-config/
  apps/
    myapp/
      base/
        deployment.yaml
        service.yaml
        kustomization.yaml
      overlays/
        dev/
          kustomization.yaml
          replica-patch.yaml
        production/
          kustomization.yaml
          replica-patch.yaml
```

### Example Manifests

```yaml
# apps/myapp/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp
        image: ghcr.io/myorg/myapp:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 100m
            memory: 128Mi

---
# apps/myapp/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

```yaml
# apps/myapp/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml

---
# apps/myapp/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
patches:
- replica-patch.yaml

---
# apps/myapp/overlays/production/replica-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3   # production gets 3 replicas
```

Commit and push this to GitHub (or any Git host ArgoCD can reach).

---

## Step 3: Connect the Repository and Create an Application

### Connect the Repository

```bash
# If the repo is private, provide credentials
argocd repo add https://github.com/myorg/platform-config \
  --username git \
  --password <github-personal-access-token>

# Verify connection
argocd repo list
```

### Create an ArgoCD Application

```yaml
# argocd-apps/myapp-production.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-production
  namespace: argocd
  finalizers:
  - resources-finalizer.argocd.argoproj.io  # ensures cleanup on deletion
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/platform-config
    targetRevision: HEAD
    path: apps/myapp/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true       # delete resources removed from Git
      selfHeal: true    # revert manual cluster changes
    syncOptions:
    - CreateNamespace=true   # create the namespace if it doesn't exist
```

```bash
# Apply the Application definition
kubectl apply -f argocd-apps/myapp-production.yaml

# Check sync status
argocd app get myapp-production

# Watch it sync
argocd app sync myapp-production
```

In the ArgoCD UI, you'll see a tree view showing every resource deployed, its health, and its sync status.

---

## Step 4: The Full GitOps Loop

Now test the full workflow:

```bash
# Make a change in your platform-config repo
# Edit apps/myapp/overlays/production/replica-patch.yaml
# Change replicas from 3 to 5

git add .
git commit -m "scale production myapp to 5 replicas"
git push

# ArgoCD detects the change within 3 minutes (default polling interval)
# Or trigger immediately:
argocd app sync myapp-production

# Watch the rollout
kubectl rollout status deployment/myapp -n production
```

**Test self-healing:**

```bash
# Manually scale down (this will be reverted)
kubectl scale deployment/myapp --replicas=1 -n production

# Within ArgoCD's sync interval (3 minutes), it reverts to Git's desired state (5)
# Watch:
argocd app sync myapp-production --force
kubectl get deployment/myapp -n production
```

---

## Step 5: Automated Image Updates

The most common GitOps pattern is having your CI pipeline update the image tag in the config repo, then ArgoCD deploys the new version automatically.

```yaml
# In your CI pipeline (.github/workflows/deploy.yml)
- name: Update image tag in platform-config repo
  uses: actions/checkout@v4
  with:
    repository: myorg/platform-config
    token: ${{ secrets.PLATFORM_CONFIG_TOKEN }}
    path: platform-config

- name: Update image tag
  run: |
    cd platform-config
    # Update the image tag in the overlay
    kustomize edit set image ghcr.io/myorg/myapp=ghcr.io/myorg/myapp:${{ github.sha }}
    git config user.email "ci@myorg.com"
    git config user.name "CI Bot"
    git commit -am "ci: update myapp image to ${{ github.sha }}"
    git push
```

The full loop:
1. Developer pushes code
2. CI runs tests and builds Docker image
3. CI updates image tag in platform-config repo
4. ArgoCD detects the change and rolls out the new image

No manual deployments. No SSH. No `kubectl apply` from laptops. Everything is tracked in Git.

---

## Useful ArgoCD Commands

```bash
# List all applications
argocd app list

# Sync an app immediately
argocd app sync myapp-production

# Get detailed app status
argocd app get myapp-production

# View app history
argocd app history myapp-production

# Roll back to a previous version
argocd app rollback myapp-production 3   # revision number

# Delete an application (with cascade delete of resources)
argocd app delete myapp-production --cascade
```

---

## Conclusion

ArgoCD turns Git into the control plane for your cluster. Once it's running, the workflow becomes: make a change in Git, let ArgoCD apply it. Rollbacks are git reverts. Deployment history is your git log. Manual changes are automatically corrected. This is the core of GitOps — and it's one of the highest-leverage improvements a platform team can make, because it removes the biggest sources of configuration drift and undocumented manual changes.

---

**Want to build GitOps skills end-to-end with structured lab exercises?** The full curriculum is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
