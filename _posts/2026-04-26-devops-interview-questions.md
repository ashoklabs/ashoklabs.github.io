---
title: "DevOps Interview Questions — The 30 You'll Actually Get Asked"
categories: [devops, career]
date: 2026-04-26
image: https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80
description: The 30 DevOps interview questions that appear most often — with the answers hiring managers actually want to hear, not the ones that just sound impressive.
---

# DevOps Interview Questions — The 30 You'll Actually Get Asked

**Primary keyword:** DevOps interview questions
**Secondary keywords:** DevOps engineer interview prep, DevOps technical interview, common DevOps interview questions

---

## Introduction

DevOps interviews test two things: whether you understand the concepts, and whether you've actually applied them in a real environment. The questions below appear in some form in nearly every DevOps interview. The answers that get offers are the ones that combine conceptual clarity with specific examples — not abstract definitions, and not vague claims of "experience with Kubernetes." This guide covers the 30 most common questions and the answers that land.

---

## Conceptual and Fundamentals

### 1. What is DevOps, and how does it differ from traditional operations?

DevOps is a culture and set of practices that closes the gap between software development and operations. In traditional organizations, developers write code and throw it over a wall to ops, who deploy it manually and own production stability. DevOps integrates the two: developers own their code in production, operations is automated through CI/CD pipelines, and the feedback loop from production to development is tight. The result is faster, more reliable software delivery.

### 2. What is CI/CD and why does it matter?

**Continuous Integration (CI)** is the practice of automatically building and testing code on every commit. Every developer's change is validated against the full test suite before it's merged.

**Continuous Delivery (CD)** extends CI by automatically deploying code to staging environments after passing tests. **Continuous Deployment** goes further — automatically deploying to production on every successful build.

It matters because: faster feedback loops catch bugs earlier (when they're cheaper to fix), automated deployments eliminate human error in the release process, and frequent small deployments are less risky than infrequent large ones.

### 3. Explain the difference between containers and virtual machines.

VMs virtualize hardware — each VM runs a full OS on top of a hypervisor. Containers share the host OS kernel and isolate only the application and its dependencies. Containers are much lighter (MBs vs GBs), start faster (seconds vs minutes), and are more portable. VMs offer stronger isolation because each has its own kernel. Containers are the right choice for application deployment; VMs are still appropriate for workloads requiring stronger isolation or running different OS types.

### 4. What is Infrastructure as Code (IaC) and what problem does it solve?

IaC is the practice of defining infrastructure in machine-readable code rather than through manual processes or GUI consoles. It solves: reproducibility (you can recreate any environment exactly), version control (infrastructure changes are tracked in Git like code), and consistency (staging and production environments can be defined identically).

### 5. What is the difference between Terraform and Ansible?

Terraform is for infrastructure provisioning — it creates and manages cloud resources (EC2 instances, VPCs, databases). It manages lifecycle: creation, modification, deletion. Ansible is for configuration management — given a running server, it configures it: installs packages, writes config files, manages services. They're complementary: Terraform creates the infrastructure, Ansible configures what's running on it.

---

## CI/CD and Automation

### 6. How would you design a CI/CD pipeline for a microservices application?

A well-designed pipeline for microservices:
1. Trigger on every PR and push to main
2. Run tests (unit, integration) in parallel across services
3. Build Docker images with multi-stage Dockerfiles
4. Scan images for vulnerabilities (Trivy or similar)
5. Push tagged images to a container registry (tagged with git SHA)
6. Deploy to staging automatically on merge to main
7. Run smoke tests against staging
8. Require manual approval for production
9. Deploy to production with a health check rollout
10. Roll back automatically if the deployment fails

Each service should have its own pipeline. Changes to one service shouldn't block deployment of another.

### 7. How do you handle secrets in a CI/CD pipeline?

Never hardcode secrets. The options:
- **GitHub Actions secrets** — stored encrypted, injected as environment variables at runtime. Good for most cases.
- **HashiCorp Vault** — secrets management for more complex requirements. Services retrieve secrets at runtime with short-lived tokens.
- **AWS Secrets Manager / Azure Key Vault** — cloud-native secret storage, accessed by services at runtime using IAM roles (no static credentials).

The principle: secrets should never appear in code, logs, or environment configurations that are committed to source control.

### 8. What is blue-green deployment?

Blue-green deployment maintains two identical production environments (blue and green). One serves live traffic; the other is idle. When deploying a new version, you deploy to the idle environment, run tests, then switch the load balancer to send traffic to it. The old environment remains on standby for instant rollback. The tradeoff: requires double the infrastructure.

### 9. What is a canary deployment?

A canary deployment gradually shifts traffic from the old version to the new one — for example, 5% → 25% → 50% → 100%. You monitor error rates and latency at each stage. If metrics degrade, roll back before all users are affected. Istio or Argo Rollouts implement this at the Kubernetes level. Lower risk than full deployments, but more complex to implement.

---

## Kubernetes

### 10. What is the difference between a Deployment and a StatefulSet?

**Deployment** is for stateless applications. Pods are interchangeable — any pod can handle any request. Pods have random names and are replaced freely.

**StatefulSet** is for stateful applications (databases, distributed systems). Pods have stable, persistent identities (pod-0, pod-1) and stable network names. Pod startup and deletion happen in order. Each pod gets its own PersistentVolume.

Use Deployments for web services, APIs, and workers. Use StatefulSets for Postgres, Redis, Kafka, Elasticsearch.

### 11. How does Kubernetes handle rolling updates?

When you update a Deployment (new image tag, resource change), Kubernetes performs a rolling update by default: it creates new pods with the updated configuration and terminates old ones gradually, according to `maxSurge` (how many extra pods can exist during update) and `maxUnavailable` (how many pods can be unavailable during update). This maintains availability throughout the update. If the new pods fail health checks, the rollout pauses — you can then roll back with `kubectl rollout undo deployment/myapp`.

### 12. What is a Kubernetes Namespace and why would you use multiple?

A Namespace is a logical partition within a cluster. They're used to: isolate environments (dev, staging, production in separate namespaces), apply RBAC per team (team A can only access their namespace), enforce resource quotas (limit how much CPU/memory a team can use), and logically separate applications in a shared cluster.

Best practice: one namespace per environment, one namespace per team in a shared cluster.

### 13. Explain the role of Kubernetes RBAC.

Role-Based Access Control (RBAC) controls who can do what in a Kubernetes cluster. It has four components:
- **Role/ClusterRole** — defines permissions (verbs: get, list, create, delete on resources: pods, deployments, secrets)
- **ServiceAccount** — identity for a pod or application
- **RoleBinding/ClusterRoleBinding** — binds a Role to a ServiceAccount, User, or Group

The principle of least privilege applies: a service account for a web API should be able to read its own ConfigMaps but not modify Deployments or read Secrets in other namespaces.

### 14. What causes a pod to enter CrashLoopBackOff?

The container exits (crashes) repeatedly, and Kubernetes keeps restarting it with exponential backoff. Common causes:
- Application error at startup (check `kubectl logs <pod>`)
- Missing environment variable or secret
- Wrong command or entrypoint in the Dockerfile
- Port conflict (two containers trying to bind the same port)
- Missing dependency (database not ready, required service unreachable)

Diagnosis: `kubectl describe pod <pod>` (shows events and exit reason), `kubectl logs <pod> --previous` (logs from the previous container instance).

---

## Infrastructure and Security

### 15. How do you prevent configuration drift in infrastructure?

**Immutable infrastructure** — never modify running resources. Replace them. This prevents drift entirely because you can't change something that's immutable.

**Drift detection** — run `terraform plan` on a schedule. Any changes made outside of Terraform show up as drift. Alert the team.

**GitOps** — ArgoCD continuously reconciles cluster state to Git. Manual kubectl changes are automatically reverted.

The combination of IaC + GitOps + scheduled drift detection catches most sources of drift before they compound into incidents.

### 16. What is least privilege and how do you apply it in a Kubernetes environment?

Least privilege means giving a service the minimum permissions it needs to function — nothing more. In Kubernetes:
- Create dedicated ServiceAccounts per application — never use the default
- Define RBAC Roles with only the specific permissions required
- Apply NetworkPolicies: deny all ingress/egress by default, allow only what's needed
- Use Pod Security Standards to prevent containers from running as root or using privileged mode
- Use Secrets instead of ConfigMaps for sensitive data (and use external secret managers for production)

### 17. How would you secure a Docker container in production?

- Use minimal base images (distroless, alpine) to reduce attack surface
- Run as a non-root user (`USER 1001:1001` in Dockerfile)
- Scan images for CVEs with Trivy before pushing to registry
- Use multi-stage builds to exclude build tools from runtime images
- Set `readOnlyRootFilesystem: true` in Kubernetes pod spec
- Drop Linux capabilities: `securityContext.capabilities.drop: ["ALL"]`
- Never use `--privileged`
- Pin base image versions (not `latest`)

---

## Observability and Incident Response

### 18. What is the difference between monitoring and observability?

**Monitoring** answers known questions: "Is the service up?", "Is CPU above 80%?" You define the metrics you care about in advance.

**Observability** allows you to ask new questions about a system without instrumenting it further. A system is observable if you can understand its internal state from its external outputs (metrics, logs, traces). High observability means you can diagnose novel failures you didn't anticipate.

In practice: Prometheus/Grafana provide monitoring. OpenTelemetry distributed tracing provides the additional observability that lets you trace a request through multiple services.

### 19. Walk me through how you'd respond to a production incident.

1. **Detect** — alert fires (Alertmanager, PagerDuty)
2. **Acknowledge** — claim the incident, start incident chat channel, communicate status page update
3. **Triage** — is it customer-impacting? What's the scope? What changed recently?
4. **Mitigate first** — restore service before finding root cause. Rollback the recent deploy, scale up replicas, enable a feature flag off. Stabilize first.
5. **Investigate** — check logs, metrics, traces to understand root cause
6. **Fix and verify** — apply the fix, monitor metrics to confirm recovery
7. **Communicate** — update status page, send all-clear
8. **Postmortem** — blameless writeup within 48-72 hours: timeline, root cause, contributing factors, action items

### 20. What metrics would you use to measure the health of a service?

The RED method: **Rate** (requests per second), **Errors** (error rate as percentage), **Duration** (latency — p50, p95, p99). These three metrics, applied to every service, give you a comprehensive view of health. Supplement with saturation metrics: CPU, memory, connection pool usage — resources approaching limits.

---

## Behavioral and Situational

### 21. Tell me about a production incident you caused or responded to.

This is the most important question in the interview. Have a real story ready. Structure it as: what was the situation, what did you do, what was the outcome, what did you learn. "I deployed a change that caused a 15-minute outage. I rolled back within 3 minutes of detection, implemented a feature flag to safely re-deploy, and wrote a postmortem that led to adding an automated smoke test that would have caught the issue before it reached production." Interviewers want to see ownership, clear thinking under pressure, and learning.

### 22. How do you handle a disagreement with a developer about how their service should be deployed?

The platform team's job is to enable developer velocity within guardrails that protect reliability and security. Frame the conversation around constraints and tradeoffs: "Here's what we need for production reliability, and here are the options that meet those requirements." Avoid unilateral mandates without explanation. If you can't agree, escalate to a documented architectural decision that both parties can review and comment on.

### 23. How do you stay current with the DevOps landscape?

Be specific: which blogs, newsletters, or communities you follow. Good answers include: CNCF landscape updates, the Kubernetes release notes, specific engineers whose writing you respect, conference talks from KubeCon, and the GitHub discussions of tools you use in production. "I try to follow a new tool for a week in my home lab before recommending it at work" is a strong answer — it shows hands-on approach to learning.

---

## Additional Quick Questions

**24. What is the purpose of a readinessProbe vs a livenessProbe?** `readinessProbe` controls when traffic is routed to a pod. `livenessProbe` controls when a pod is restarted. A pod that fails readiness is removed from Service endpoints but not restarted. A pod that fails liveness is restarted.

**25. What is etcd in Kubernetes?** A distributed key-value store that holds all cluster state — every object, every configuration, every secret. Backing up etcd is critical for disaster recovery.

**26. What is Helm?** Kubernetes' package manager. Charts are templated bundles of Kubernetes manifests that can be customized with values files and deployed with a single command.

**27. What does `terraform state` do?** State is Terraform's record of what resources it has created and their current configuration. It maps your Terraform configuration to real cloud resources and tracks dependencies.

**28. What is GitOps?** The practice of using Git as the single source of truth for both application code and infrastructure configuration, with automated tools (ArgoCD, Flux) continuously reconciling the live environment to match what's declared in Git.

**29. How would you debug a container that exits immediately?** `kubectl logs <pod> --previous` for crash logs. `kubectl describe pod <pod>` for events and exit reason. If no logs, try running the image interactively: `docker run -it --entrypoint=/bin/sh <image>` to inspect the container filesystem and run the entrypoint manually.

**30. What is a Service Mesh?** A dedicated infrastructure layer for service-to-service communication that adds: mutual TLS (mTLS) between services, traffic management (canary routing, circuit breakers), and observability (request traces, connection metrics). Istio and Linkerd are the most common implementations.

---

## Conclusion

The best way to prepare for DevOps interviews is to have built the things you're describing. A candidate who can say "I set up this GitOps workflow, and here's what I learned when the ArgoCD sync failed" is more compelling than one who can recite definitions. Build projects, document them, and practice articulating both what you built and why you made the decisions you made.

---

**Want to build the hands-on experience that makes these answers real?** The structured curriculum at ashoklabs.com covers every topic in this guide.

**[Explore the courses →](https://ashoklabs.com/courses)**
