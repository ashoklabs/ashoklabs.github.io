---
title: "GitOps Principles: How Platform Teams Deploy Apps and Cloud Resources Faster — and Finally Build the Things That Matter"
categories: [gitops, devops, platform-engineering]
date: 2026-04-03
image: https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=600&q=80
description: GitOps extends beyond app deployments — cloud resources, databases, and networks can all be Git-managed, giving platform teams back the time to build real improvements.
---

# GitOps in Production: How Platform Teams Deploy Everything From Git — and Reclaim Time to Build What Actually Matters

**Primary keyword:** GitOps principles platform teams
**Secondary keywords:** GitOps cloud resource provisioning, Crossplane GitOps, Backstage internal developer platform, reduce DevOps toil

---

## Introduction

Most ops teams aren't slow because the people are slow. They're slow because the process requires it: manual deployments, environment-specific scripts, cloud resources provisioned by hand in the console, and a release process that only two people fully understand. GitOps changes the model — not just for application deployments, but for everything your team manages. Kubernetes workloads, S3 buckets, RDS instances, VPCs, IAM roles — all of it can be declared in Git and reconciled automatically. Add a self-service developer portal like Backstage on top, and the ticket queue that was consuming your platform team's days starts to shrink on its own. This guide covers the core GitOps principles, how they apply to cloud resources (not just apps), where the real time savings come from, and what teams build when they stop being blocked by toil.

---

## The Four Principles GitOps Is Actually Built On

GitOps isn't a tool — it's a set of principles that, when applied consistently, change how everything is managed. The four that matter:

**1. Declarative configuration.** You describe the desired state of your system, not the steps to get there. Kubernetes manifests, Helm charts, Terraform modules, Crossplane compositions — everything is a declaration. The system figures out how to reconcile current state with desired state.

**2. Git as the single source of truth.** Every desired state lives in a Git repository. Application deployments, cloud infrastructure, network configuration, database provisioning. If it isn't in Git, it doesn't exist from the platform's perspective.

**3. Approved changes through pull requests.** The only way to change the system is to change what's in Git, through a PR that goes through your normal review process. Every change is auditable, reviewable, and reversible. Your Git history is your deployment history — and your audit log.

**4. Continuous reconciliation.** An operator (ArgoCD, Flux, Crossplane) watches the Git repository and continuously syncs the live environment to match it. If something drifts — someone edits a resource directly in the console, a node restarts with a different config, someone manually resizes an RDS instance — the operator detects it and corrects it. Drift doesn't accumulate silently.

---

## GitOps for Cloud Resources — Not Just Application Deployments

Most teams start GitOps with application deployments and stop there. That's understandable — it's the most visible pain — but it leaves the biggest time sink untouched: cloud resource provisioning.

Provisioning an RDS instance, an S3 bucket, a VPC, a Redis cluster, or a new Kafka topic typically means either clicking through the AWS console (undocumented, unrepeatable) or running a Terraform plan manually (slow, requires the right person, easy to forget to commit the result). Neither fits in a GitOps workflow. Both create drift.

**Crossplane: Kubernetes-native cloud provisioning.** Crossplane extends the Kubernetes API to include cloud resources. You define an RDS instance or an S3 bucket as a Kubernetes Custom Resource, commit it to Git, and ArgoCD or Flux deploys it the same way it would deploy a Kubernetes Deployment. The cloud resource is reconciled continuously — if someone modifies it directly in the console, Crossplane corrects it.

```yaml
apiVersion: database.aws.crossplane.io/v1beta1
kind: RDSInstance
metadata:
  name: payments-db
spec:
  forProvider:
    region: us-east-1
    dbInstanceClass: db.t3.medium
    engine: postgres
    engineVersion: "15"
    allocatedStorage: 100
    multiAZ: true
  writeConnectionSecretsToRef:
    namespace: payments
    name: payments-db-credentials
```

Commit that to your platform-config repo. ArgoCD syncs it. Crossplane provisions the database. The connection secret lands in the cluster automatically. No console clicks. No manual `terraform apply`. No waiting for someone with the right AWS credentials to be available.

**Terraform + Atlantis: GitOps for infrastructure that isn't Kubernetes-native.** Not everything fits neatly into Crossplane. For complex VPC setups, EKS cluster provisioning, or multi-account AWS configurations, Terraform is often the right tool. Atlantis brings GitOps to Terraform: `terraform plan` runs automatically on every pull request, and `terraform apply` is triggered by a PR comment after review — no one runs it from their laptop.

```
# In a PR comment, after reviewing the plan output:
atlantis apply -d infrastructure/environments/production
```

The plan output is in the PR. The apply is tracked in Git. The state is remote. The process is the same whether you're deploying an app or provisioning a new customer's cloud environment.

**The combined effect on platform team time is significant.** Cloud resource requests that previously required a ticket, a back-and-forth on requirements, a manual apply, and a confirmation ping get replaced with a PR that provisions the resource automatically on merge. A workflow that took days of calendar time compresses to minutes of async review.

---

## ArgoCD in Practice: What Continuous Reconciliation Looks Like for Apps

For Kubernetes workloads, ArgoCD is the standard GitOps operator. You define an Application resource that points at a Git repository and a target cluster, and ArgoCD handles the rest.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: payments-service
  namespace: argocd
spec:
  destination:
    namespace: payments
    server: https://kubernetes.default.svc
  source:
    path: k8s/overlays/production
    repoURL: https://github.com/myorg/platform-config
    targetRevision: HEAD
  syncPolicy:
    automated:
      prune: true      # remove resources deleted from Git
      selfHeal: true   # correct drift automatically
```

With `selfHeal: true`, any manual change to a resource managed by ArgoCD gets reverted on the next sync cycle — typically within a few minutes. With `prune: true`, resources deleted from Git are removed from the cluster. The Git repository is authoritative, and ArgoCD enforces that continuously.

The ArgoCD UI gives the platform team a single view of what's deployed, what's in sync, and what diverged — across every environment, every application. That visibility alone cuts time spent answering "what version is running in staging right now?"

---

## Where the Time Savings for Platform Teams Actually Come From

The promise of GitOps is that it reduces toil. Here's where that shows up concretely:

**No more manual environment management.** Promoting a change from staging to production becomes a pull request. No scripts, no manual config updates, no hoping that staging was close enough to prod.

**Deployments happen without someone watching them.** An ArgoCD sync doesn't need anyone present. Ops engineers stop spending time on deployment watch — logging in, tailing logs, confirming success — and the system handles it. For teams doing multiple deploys a day, this recovers meaningful hours weekly.

**Cloud provisioning requests stop becoming tickets.** With Crossplane or Atlantis in place, a developer who needs a new database or a new S3 bucket opens a PR to the platform-config repo. The platform team reviews the PR, merges it, and the resource provisions automatically. The ticket queue shrinks. The back-and-forth stops.

**Rollbacks are a git revert, not a war room.** When something breaks, the fix is `git revert`. The previous state is already declared in version control, and the reconciliation loop applies it. No SSH into servers, no emergency script runs, no manual undo of undocumented changes.

**Fewer incidents from drift.** Configuration drift — where live infrastructure gradually diverges from what anyone documented — is one of the biggest sources of unexpected incidents. GitOps eliminates the category. Drift gets corrected before it compounds.

---

## Backstage and Internal Developer Platforms: The Self-Service Layer That Multiplies Everything

GitOps handles the backend of self-service — resources are declared in Git and provisioned automatically. Backstage handles the frontend: the interface developers actually use to interact with the platform.

[Backstage](https://backstage.io), the open-source developer portal originally built at Spotify, gives developers a unified place to discover services, create new ones from templates, view documentation, and check deployment status — without knowing anything about the underlying infrastructure.

**Software catalog.** Every service your organization runs lives in Backstage's catalog, with ownership, documentation, runbooks, dependencies, and deployment status surfaced in one place. When a platform engineer needs to know who owns the payments service, or when a developer needs to find the API for the user service, they check the catalog instead of pinging someone on Slack.

**Self-service scaffolding.** A developer who wants to create a new service fills out a form in Backstage — service name, team, language, database needed — and Backstage's scaffolding system creates the repository, applies the team's standard Helm chart, creates the ArgoCD Application resource, registers the service in the catalog, and wires up monitoring dashboards. What previously took a platform engineer a day of setup takes a developer five minutes.

```yaml
# Backstage scaffolder template (simplified)
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: new-service
spec:
  parameters:
    - title: Service details
      properties:
        serviceName:
          type: string
        teamName:
          type: string
        needsDatabase:
          type: boolean
  steps:
    - id: create-repo
      action: publish:github
    - id: apply-helm-chart
      action: kubernetes:apply
    - id: register-in-catalog
      action: catalog:register
```

**Measured impact on platform teams.** Teams that deploy Backstage consistently report a significant drop in the volume of "how do I..." and "can you set up a..." requests to the platform team. The platform team's job shifts from fulfilling individual requests to maintaining the templates, guardrails, and integrations that let developers self-serve. That's a fundamentally different — and higher-leverage — use of engineering time.

---

## What Platform Teams Build When They Stop Being Blocked by Toil

This is the part that gets skipped in most GitOps articles. Faster deployments and reduced ticket volume are means to an end. The real value is what the team builds with the recovered time.

**Better reliability engineering.** A team that's not manually managing deployments has time to instrument their systems properly — meaningful SLOs, alerting that fires on symptoms rather than causes, runbooks that actually reflect how the system works. Reliability work that was always important but never urgent becomes possible.

**Improved onboarding for new teams.** With GitOps patterns established and Backstage templates in place, onboarding a new team to the platform becomes a repeatable process rather than a bespoke engagement. The platform team documents it once, encodes it in a template, and new teams self-serve.

**Skills that compound.** Engineers on platform teams that are no longer consumed by toil have time to go deeper — Kubernetes internals, eBPF-based observability, advanced Istio traffic management, cost optimization tooling. These skills compound: a platform engineer who understands the system deeply can build better abstractions for everyone using it.

**Product improvements instead of maintenance.** A platform is a product. When the team has capacity, they improve it — better developer experience, tighter security defaults, faster CI pipelines, clearer feedback when something fails. Those improvements ship to every team on the platform simultaneously.

---

## Getting Started Without Replacing Everything at Once

You don't need to GitOps-ify your entire infrastructure on day one. The path that works:

Start with one non-critical application. Set up ArgoCD or Flux, point it at a Git repository, and get one service syncing automatically. Build team familiarity with the model before expanding.

Move cloud resource provisioning to Git next. Pick one resource type — S3 buckets, or a specific class of database — and set up Crossplane or Atlantis for it. Show the team what it looks like when a resource is declared in Git and provisioned on merge.

```
platform-config/
  apps/
    payments-service/
      overlays/
        dev/
        staging/
        production/
  infrastructure/
    databases/
      payments-db.yaml        # Crossplane RDSInstance
    storage/
      uploads-bucket.yaml     # Crossplane S3Bucket
    networking/
      main.tf                 # Terraform via Atlantis
```

Add drift detection before adding automation. Let ArgoCD report on drift before configuring it to auto-correct. Your team learns what drift looks like before handing the system full autonomy.

Introduce Backstage incrementally. Start with the software catalog — just register your existing services. Add templates for new service creation once the catalog has enough coverage that developers are using it naturally.

---

## Conclusion

GitOps changes what platform engineering teams are for — but only if you apply it to the full scope of what they manage. App deployments are the obvious starting point. Cloud resource provisioning is where the next wave of time savings comes from. And self-service tooling like Backstage is what turns those savings into a permanent shift in how the team operates. The teams that get the most from GitOps aren't the ones that adopted it for faster deploys. They're the ones that used the recovered capacity to build a platform their developers actually want to use — and kept improving it from there.

---

**If this was useful**, I write about GitOps, platform engineering, and DevOps patterns every week. Subscribe below and get new posts straight to your inbox — no spam, unsubscribe anytime.

**[Subscribe to the newsletter →](https://ashoklabs.com/newsletter)**
