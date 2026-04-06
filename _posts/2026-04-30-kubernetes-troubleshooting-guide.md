---
title: "Kubernetes Troubleshooting Guide — How to Debug Any Pod Problem"
categories: [devops, kubernetes]
date: 2026-04-30
image: https://images.unsplash.com/photo-1623282033815-40b05d96c903?w=600&q=80
description: A systematic Kubernetes troubleshooting guide — the exact commands and mental model to debug CrashLoopBackOff, Pending pods, OOMKilled, and networking issues.
---

# Kubernetes Troubleshooting Guide — How to Debug Any Pod Problem

**Primary keyword:** Kubernetes troubleshooting guide
**Secondary keywords:** debug Kubernetes pods, CrashLoopBackOff fix, Kubernetes pod not starting, kubectl debug

---

## Introduction

Kubernetes debugging has a reputation for being opaque. An engineer new to Kubernetes sees `CrashLoopBackOff` or `Pending` in `kubectl get pods` and doesn't know where to start. The engineers who resolve these quickly aren't smarter — they have a systematic approach. This guide covers the exact commands and mental model for debugging every common Kubernetes pod problem, from containers that won't start to services that won't route traffic.

---

## The Debugging Mental Model

Start from the error state and work backward through the layers:

```
Pod status → Container logs → Events → Node state → Network → Configuration
```

Three commands answer 80% of Kubernetes debugging questions:

```bash
kubectl get pods -n <namespace>      # 1. What's the status?
kubectl describe pod <pod> -n <ns>   # 2. What events and config?
kubectl logs <pod> -n <ns>           # 3. What did the container say?
```

Learn these three in sequence. Don't skip to logs without checking events first.

---

## CrashLoopBackOff — Container Keeps Crashing

**What it means:** The container starts, crashes (exits non-zero), Kubernetes restarts it, it crashes again. Kubernetes backs off exponentially between restarts (10s, 20s, 40s, 80s, up to 5 minutes).

**Step 1: Check the logs from the crashed container**

```bash
# Current logs (might be empty if crashed immediately)
kubectl logs <pod> -n <namespace>

# Logs from the PREVIOUS container instance — this is the crash
kubectl logs <pod> -n <namespace> --previous

# If the pod has multiple containers
kubectl logs <pod> -c <container-name> -n <namespace> --previous
```

**Step 2: Check events**

```bash
kubectl describe pod <pod> -n <namespace>
# Look at the Events section at the bottom
# "Back-off restarting failed container" + exit code tells you a lot
```

**Common causes and fixes:**

| Exit Code | Meaning | Common Fix |
|-----------|---------|-----------|
| 1 | Application error | Check app logs — likely config or startup error |
| 137 | OOMKilled (out of memory) | Increase memory limits |
| 126 | Permission denied on command | Fix file permissions or entrypoint |
| 127 | Command not found | Wrong entrypoint or missing binary in image |
| 143 | SIGTERM (graceful shutdown) | Check if something is signaling the container |

**Debugging a container you can't get logs from:**

```bash
# Override the entrypoint to just sleep — keeps the container running
kubectl run debug --image=myapp:v1 --command -- sleep 3600

# Exec into it and run the start command manually
kubectl exec -it debug -- /bin/sh
# Inside: run your app command and see the error
```

---

## Pending Pods — Pod Won't Schedule

**What it means:** The pod exists but hasn't been assigned to a node.

```bash
kubectl describe pod <pod>
# Look for: "0/3 nodes are available" messages
```

**Cause 1: Insufficient resources**

```
0/3 nodes are available: 3 Insufficient cpu.
```

Fix: Check node resources and pod requests:

```bash
# Check node capacity and allocatable resources
kubectl describe nodes | grep -A5 "Allocated resources"

# Check what the pod is requesting
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].resources}'
```

Solution: Either increase node capacity (add a node) or reduce the pod's resource requests.

**Cause 2: Node selector or affinity mismatch**

```
0/3 nodes are available: 3 node(s) didn't match node selector
```

```bash
# Check pod's nodeSelector
kubectl get pod <pod> -o jsonpath='{.spec.nodeSelector}'

# Check node labels
kubectl get nodes --show-labels
```

Fix: Match the pod's nodeSelector to an existing node label, or update node labels.

**Cause 3: Taint/toleration mismatch**

```
0/3 nodes are available: 3 node(s) had untolerated taint
```

```bash
# Check node taints
kubectl describe node <node> | grep Taint

# Check pod tolerations
kubectl get pod <pod> -o jsonpath='{.spec.tolerations}'
```

Fix: Add a toleration to the pod spec matching the node taint, or remove the taint.

**Cause 4: Persistent volume claim not bound**

```bash
kubectl get pvc -n <namespace>
# If STATUS is "Pending", the volume isn't available
kubectl describe pvc <pvc-name> -n <namespace>
```

---

## OOMKilled — Out of Memory

**What it means:** The container exceeded its memory limit and was killed by the kernel.

```bash
kubectl describe pod <pod>
# Shows: "OOMKilled" in Last State
# Exit Code: 137
```

**Diagnosis:**

```bash
# Check current memory usage
kubectl top pod <pod> -n <namespace>

# Check memory limit
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].resources.limits.memory}'
```

**Fix options:**

1. Increase the memory limit in the deployment:

```yaml
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"   # increase this
```

2. Fix a memory leak in the application
3. Add a horizontal pod autoscaler (HPA) so load distributes across more pods

---

## ImagePullBackOff / ErrImagePull — Can't Pull the Image

**What it means:** Kubernetes can't download the container image.

```bash
kubectl describe pod <pod>
# Events: "Failed to pull image" with reason
```

**Cause 1: Image doesn't exist or wrong tag**

```bash
# Verify the image exists (locally or in registry)
docker pull <image>:<tag>
```

**Cause 2: Private registry without credentials**

```bash
# Create a registry pull secret
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=myuser \
  --docker-password=<token> \
  -n <namespace>

# Reference it in the pod spec
imagePullSecrets:
- name: regcred
```

**Cause 3: Registry rate limiting (Docker Hub)**

Docker Hub rate-limits unauthenticated pulls. Use authenticated pulls or mirror commonly used images to your own registry.

---

## Pods Running But Service Not Reachable

**Step 1: Confirm pods are actually healthy**

```bash
kubectl get pods -n <namespace> -l app=myapp
# All should be Running and Ready (1/1 or 2/2)
```

**Step 2: Check the Service selector**

This is the most common cause. The Service selector must exactly match the pod labels.

```bash
# Check service selector
kubectl get service myapp -n <namespace> -o jsonpath='{.spec.selector}'

# Check pod labels
kubectl get pods -n <namespace> -l app=myapp --show-labels

# View service endpoints — empty means selector doesn't match any pods
kubectl get endpoints myapp -n <namespace>
```

If endpoints are empty, the labels don't match. Fix the service selector or pod labels.

**Step 3: Test from inside the cluster**

```bash
# Create a debug pod and test the service
kubectl run debug --image=nicolaka/netshoot --rm -it -- /bin/bash

# Inside the debug pod:
curl http://myapp.mynamespace.svc.cluster.local/health
nslookup myapp.mynamespace.svc.cluster.local
nc -zv myapp 80
```

**Step 4: Check NetworkPolicies**

```bash
kubectl get networkpolicies -n <namespace>
# If policies exist, check if they're blocking the traffic path
```

---

## Container Running But App Behaving Incorrectly

**Check environment variables:**

```bash
kubectl exec -it <pod> -- env | grep <VARIABLE_NAME>
```

**Check mounted config files:**

```bash
kubectl exec -it <pod> -- cat /etc/config/app.conf
kubectl exec -it <pod> -- ls -la /etc/config/
```

**Check if the correct image version is running:**

```bash
kubectl get pod <pod> -o jsonpath='{.spec.containers[*].image}'
```

**Check resource constraints limiting performance:**

```bash
kubectl top pod <pod> -n <namespace>
# If CPU is at or near limit, the container may be throttled
```

---

## Node-Level Issues

**Check node status:**

```bash
kubectl get nodes
kubectl describe node <node-name>
# Look for: DiskPressure, MemoryPressure, PIDPressure conditions
```

**Check what's consuming node resources:**

```bash
kubectl top nodes
kubectl top pods --all-namespaces | sort -k4 -rn   # sort by memory
```

**SSH into a node (if necessary):**

```bash
# For minikube
minikube ssh

# For cloud clusters, usually via bastion host or node SSH
ssh ubuntu@<node-ip>

# Once on node, check processes
top
journalctl -u kubelet -f    # kubelet logs
crictl ps                    # running containers via containerd
```

---

## Quick Reference: Status Codes and Meanings

| Status | Meaning |
|--------|---------|
| `Pending` | Not yet scheduled to a node |
| `ContainerCreating` | Scheduled, pulling image or creating |
| `Running` | Container running (check readiness) |
| `CrashLoopBackOff` | Container keeps crashing |
| `OOMKilled` | Exceeded memory limit |
| `Completed` | Job/init container finished successfully |
| `Error` | Container exited with error |
| `ImagePullBackOff` | Can't pull container image |
| `Evicted` | Pod evicted due to node pressure |
| `Terminating` | Being deleted (stuck: check finalizers) |

---

## The Debugging Checklist

When a pod isn't working, run through these in order:

1. `kubectl get pods -n <ns>` — what is the status?
2. `kubectl describe pod <pod> -n <ns>` — any events? What's the config?
3. `kubectl logs <pod> --previous -n <ns>` — what did the container say before crashing?
4. `kubectl get endpoints <service> -n <ns>` — is the service actually routing to pods?
5. `kubectl exec -it <pod> -- env` — are environment variables set correctly?
6. `kubectl top pod <pod>` — is it hitting resource limits?
7. `kubectl get networkpolicies -n <ns>` — are network policies blocking traffic?

---

## Conclusion

Kubernetes debugging is mostly about having a systematic approach and knowing which commands to reach for. The three core commands (`get pods`, `describe pod`, `logs --previous`) answer most questions. For networking issues, `get endpoints` is the command that reveals selector mismatches. For resource issues, `kubectl top` and `describe node` show resource pressure. Build the habit of going through the checklist in order rather than jumping to guesses — it's faster in the long run.

---

**Want to practice Kubernetes troubleshooting with realistic lab scenarios?** The full curriculum is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
