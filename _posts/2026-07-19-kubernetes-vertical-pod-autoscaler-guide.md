---
title: "Kubernetes Vertical Pod Autoscaler: When to Use VPA, HPA, or Both"
categories: [kubernetes, devops]
date: 2026-07-19
image: https://i.imghippo.com/files/EqV9778lDk.png?w=1200&q=80
description: Learn how Kubernetes VPA right-sizes CPU and memory, when HPA is the better choice, and how to safely combine them without creating a scaling feedback loop.
---

# Kubernetes Vertical Pod Autoscaler: When to Use VPA, HPA, or Both

**Meta description:** Learn how Kubernetes VPA right-sizes CPU and memory, when HPA is the better choice, and how to safely combine them without creating a scaling feedback loop.

**Primary keyword:** Kubernetes Vertical Pod Autoscaler
**Secondary keywords:** VPA vs HPA, Kubernetes CPU memory requests, Kubernetes autoscaling, VPA recommendations

---

## Introduction

Most Kubernetes resource problems start with a guess.

Someone puts `100m` CPU and `128Mi` memory in a Deployment because it sounds reasonable. A few weeks later, the service is getting CPU throttled during traffic spikes, or every Pod is reserving far more memory than it ever uses. Both mistakes are expensive: one hurts users, the other wastes cluster capacity.

The **Vertical Pod Autoscaler (VPA)** is Kubernetes' answer to the second part of that problem. It watches real CPU and memory usage over time and recommends — or applies — better resource requests for each container. Instead of adding more Pods, it makes each Pod the right size.

That sounds simple until HPA enters the picture. HPA and VPA can absolutely be used in the same cluster, and sometimes for the same workload. But letting both react to CPU or memory on that workload is a reliable way to build a scaling loop nobody enjoys debugging at 2 AM.

This guide explains what VPA actually measures, how to read its recommendations, when to choose VPA or HPA, and the one safe pattern for running both together.

---

## What VPA Does (and What It Does Not Do)

VPA changes the **size of a Pod**, not the number of Pods.

It has three moving parts:

- **Recommender** — collects CPU and memory usage history, notices OOM events, and calculates a recommendation.
- **Updater** — decides whether a running Pod should be resized or replaced.
- **Admission controller** — applies the latest recommendation when a new Pod is created.

For each container, VPA produces three useful values:

| Value | What it means | How to use it |
|---|---|---|
| `lowerBound` | The lowest request VPA considers safe | A signal that your current request may be too high |
| `target` | The request VPA wants to use | Usually the number to review or apply |
| `upperBound` | A high-but-plausible request | Useful for spotting bursty workloads or setting a ceiling |

VPA works with **CPU and memory requests**. It does not know whether the application is slow, whether a queue is growing, or whether a customer is waiting for a response. That is why VPA is excellent at rightsizing, but it is not a replacement for capacity scaling based on traffic or business metrics.

Also, VPA is not built into Kubernetes the way HPA is. It is an add-on that installs a CRD, controllers, and a mutating admission webhook. You need Metrics Server (or another compatible `metrics.k8s.io` source) working before it can make useful recommendations.

---

## Minimum Cluster Version and Prerequisites

Use the VPA release that matches your cluster. For current VPA releases, the practical baseline is:

| VPA release | Minimum Kubernetes version | Note |
|---|---:|---|
| VPA 1.5.x / 1.6.x | 1.28+ | Good baseline for a current installation |
| VPA 1.3.x | 1.28+ | Use only when your platform pins this release |
| VPA 1.2.x | 1.27+ | Older compatibility option |
| VPA 1.1.x / 1.0.x | 1.25+ | Older compatibility option |

`InPlaceOrRecreate` needs Kubernetes 1.33+ with the VPA feature enabled. If your cluster cannot support in-place Pod resource updates, VPA can still work in `Initial`, `Off`, or `Recreate` mode.

Before installing VPA, check these basics:

```bash
kubectl version
kubectl top pods -A
kubectl get apiservice v1beta1.metrics.k8s.io
```

If `kubectl top` does not return metrics, fix that first. VPA recommendations based on no data are not recommendations — they are decoration.

For a self-managed cluster, the upstream install script is still the simplest starting point:

```bash
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-up.sh
```

Managed Kubernetes changes the installation story. GKE, AKS, and EKS add-ons or marketplace packages may provide VPA differently, so use the provider-supported method where one exists.

---

## Start With Recommendation Mode, Not Automatic Changes

There is a strong temptation to install VPA and immediately use `Auto`. Don't. `Auto` is deprecated in modern VPA releases anyway; use an explicit update mode.

Start with `Off`. It collects the same history and writes recommendations to the VPA status, but it does not touch a running Pod. This gives you time to compare the recommendation with application dashboards, known traffic patterns, and your existing requests.

Here is a realistic example for an API Deployment:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: orders-api-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orders-api
  updatePolicy:
    updateMode: "Off"
  resourcePolicy:
    containerPolicies:
      - containerName: orders-api
        controlledResources: ["cpu", "memory"]
        controlledValues: RequestsOnly
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: "2"
          memory: 2Gi
```

Two details here matter in production:

- `minAllowed` prevents VPA from shrinking a request below a value you know is unsafe.
- `maxAllowed` prevents one unusual workload window from turning a modest API Pod into a 12 GB scheduling problem.

`RequestsOnly` is a sensible default for many teams. It lets VPA tune scheduling requests while you keep explicit control of CPU and memory limits. Be deliberate with memory limits: VPA can size a request well and your container can still be OOMKilled if its limit remains too low.

After the workload has seen representative traffic — not just a quiet Tuesday morning — inspect its recommendation:

```bash
kubectl describe vpa orders-api-vpa -n production
```

You will see output similar to this:

```text
Recommendation:
  Container Recommendations:
    Container Name: orders-api
    Lower Bound:
      Cpu:     180m
      Memory:  420Mi
    Target:
      Cpu:     350m
      Memory:  640Mi
    Upper Bound:
      Cpu:     900m
      Memory:  1Gi
```

This tells a much more useful story than a single `kubectl top` snapshot. The current request may be too low for memory, while CPU has plenty of headroom. Review the target against latency, error rate, garbage collection, and any known batch windows before accepting it.

---

## Try It Yourself: Nginx, VPA, and a Small Load Test

The easiest way to understand VPA is to give it a deliberately undersized Pod and watch its recommendation change. This example uses nginx because there is nothing else to troubleshoot. **Use a non-production namespace or a disposable cluster.**

Apply this manifest. The nginx container starts with a small CPU request, while VPA runs in recommendation-only mode:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vpa-demo
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-vpa-demo
  namespace: vpa-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx-vpa-demo
  template:
    metadata:
      labels:
        app: nginx-vpa-demo
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
            limits:
              cpu: 500m
              memory: 128Mi
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-vpa-demo
  namespace: vpa-demo
spec:
  selector:
    app: nginx-vpa-demo
  ports:
    - port: 80
      targetPort: 80
---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nginx-vpa-demo
  namespace: vpa-demo
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-vpa-demo
  updatePolicy:
    updateMode: "Off"
  resourcePolicy:
    containerPolicies:
      - containerName: nginx
        controlledResources: ["cpu", "memory"]
        controlledValues: RequestsOnly
        minAllowed:
          cpu: 25m
          memory: 32Mi
        maxAllowed:
          cpu: "1"
          memory: 256Mi
```

Save it as `nginx-vpa-demo.yaml`, then apply it:

```bash
kubectl apply -f nginx-vpa-demo.yaml
kubectl get pods -n vpa-demo -w
```

Once nginx is running, start a temporary BusyBox Pod that continuously requests the nginx Service. Open a second terminal for this command; it stays attached until you stop it with `Ctrl+C`.

```bash
kubectl run nginx-load-generator \
  --namespace vpa-demo \
  --rm -it \
  --restart=Never \
  --image=busybox:1.36 \
  -- /bin/sh -c 'while true; do wget -q -O /dev/null http://nginx-vpa-demo; done'
```

Now observe the workload from another terminal:

```bash
# Confirm the resource metrics are moving
kubectl top pod -n vpa-demo

# Read VPA's lower bound, target, and upper bound
kubectl describe vpa nginx-vpa-demo -n vpa-demo
```

Leave the load generator running for at least five to ten minutes. VPA uses usage history, so it is intentionally slower and less jumpy than an HPA. In `Off` mode, the nginx Pod will not restart and its requests will not change; only the recommendation in the VPA status changes.

When you are satisfied with the recommendation, stop the load generator and clean up:

```bash
kubectl delete namespace vpa-demo
```

If you want to see VPA apply its recommendation after the observation phase, change `updateMode` from `Off` to `Recreate`. Expect the nginx Pod to be evicted and recreated with new requests. That is exactly why this experiment starts in `Off` mode.

---

## When to Enable VPA

VPA is the right first tool when the *shape* of an individual Pod is wrong but the number of replicas is relatively stable.

Good fits include:

- A StatefulSet such as PostgreSQL, Elasticsearch, or a message broker where adding replicas is not the immediate answer.
- Internal services with steady traffic but poorly guessed CPU and memory requests.
- Batch Jobs, CronJobs, and workers that need a sensible request at creation time.
- A platform team trying to remove years of copy-pasted `resources:` blocks from application charts.
- Any workload repeatedly being OOMKilled because memory requests were guessed rather than measured.

Choose the update mode to match the disruption your workload can tolerate:

| Mode | Behaviour | Use it when |
|---|---|---|
| `Off` | Recommends only | You are learning the workload or validating VPA |
| `Initial` | Sets requests only on Pod creation | New Pods are frequent, or you want zero VPA-driven restarts |
| `Recreate` | Evicts and recreates Pods when needed | The workload is replicated and protected by a PDB |
| `InPlaceOrRecreate` | Attempts an in-place resize, then recreates if needed | Your 1.33+ cluster supports it and you want fewer restarts |

For most production rollouts, `Off` first, then `Initial`, is a calm way to earn trust in the recommendations. Move to `Recreate` only after confirming the Deployment has multiple replicas, correct readiness probes, and a PodDisruptionBudget that will not make an update unsafe.

---

## When HPA Is the Better Choice

HPA changes the **number of replicas**. It is the better choice when demand changes and one Pod cannot serve all of it quickly enough.

Use HPA when:

- HTTP request volume rises and falls throughout the day.
- A worker queue grows and you need more consumers.
- A custom or external metric represents demand better than container resource use: requests per second, queue depth, active sessions, or lag.
- You need fast reaction to traffic; HPA's control loop normally checks metrics every 15 seconds.

CPU-based HPA is common, but it is not always the best production signal. CPU is a proxy for demand. Queue depth or requests per second is often closer to the thing users actually feel.

Here is an HPA that scales a worker from an external queue-depth metric:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: invoices-worker
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: invoices-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: External
      external:
        metric:
          name: queue_messages_ready
          selector:
            matchLabels:
              queue: invoices
        target:
          type: AverageValue
          averageValue: "25"
```

This is an ideal HPA metric to pair with VPA because the two controllers are answering different questions: HPA answers “how many workers?”, while VPA answers “how large should each worker be?”

---

## Can You Run HPA and VPA Together?

Yes — **when they do not control the same resource signal.**

The safe, useful pattern is:

- VPA manages CPU and/or memory requests.
- HPA scales replicas from an external metric, object metric, or a custom metric that is independent of those requests.

For example, an order-processing worker can use VPA to learn that each container needs `500m` CPU and `768Mi` memory. Its HPA can scale from queue depth. There is no circular dependency, so both controllers can do their jobs.

Another conservative option is to leave VPA in `Off` mode, copy its reviewed recommendations into the Deployment yourself, and let HPA continue scaling on CPU. That is not fully automatic VPA, but it is safe and often the right trade-off for a customer-facing API.

---

## Why HPA and VPA Fight Over the Same CPU or Memory Metric

Do not let VPA actively change CPU or memory requests while HPA uses CPU or memory **utilization** for the same workload.

The reason is easy to miss: an HPA utilization percentage is calculated using the Pod's **request** as its denominator.

```text
CPU utilization = current CPU usage / CPU request
```

Imagine four API Pods, each using 300m CPU:

| State | CPU request per Pod | Observed CPU utilization | HPA target | HPA reaction |
|---|---:|---:|---:|---|
| Before VPA | 600m | 50% | 60% | Keep 4 replicas |
| VPA lowers request | 300m | 100% | 60% | Scale toward 7 replicas |

Nothing about real traffic changed. VPA made the request more accurate; HPA interpreted the changed percentage as a traffic spike and added Pods.

Once those extra Pods exist, per-Pod usage falls. VPA sees lower usage in its history and may recommend another smaller request. That smaller request raises HPA's utilization percentage again. The two controllers are now influencing each other's input rather than responding to demand.

The outcome is usually some combination of:

- Replica count flapping.
- Unnecessary Pod creation and termination.
- Worse scheduling because the request numbers keep moving.
- Hard-to-explain capacity costs.
- An autoscaling incident that disappears as soon as someone disables one controller.

Memory has the same denominator problem when HPA uses average memory utilization. Avoid that pairing too.

There is one nuance: HPA can use an **absolute** `AverageValue` resource target instead of utilization. That removes the request denominator, but it is still usually clearer to keep automatic VPA and HPA on separate signals. The operational rule is simple enough to remember: if VPA changes CPU or memory requests, make HPA scale on traffic, queue depth, or another independent metric.

---

## A Production Checklist Before Turning VPA On

- Confirm Metrics Server is healthy with `kubectl top pods -A`.
- Start with `updateMode: Off` and wait for normal traffic, scheduled jobs, and peak periods to occur.
- Set `minAllowed` and `maxAllowed` for every important container.
- Treat sidecars separately; a proxy or log agent can have a very different resource profile from the app container.
- Check actual OOMKills, latency, and throttling — not only VPA's target number.
- Use `RequestsOnly` unless you have consciously decided VPA should manage limits too.
- Add a PodDisruptionBudget and verify multiple healthy replicas before using a recreation-based mode.
- Do not pair active VPA CPU/memory control with HPA CPU/memory utilization on the same workload.
- Make sure your Cluster Autoscaler or node capacity can accommodate an upward recommendation; a better request still needs somewhere to schedule.

---

## Final Takeaway

VPA is a rightsizing tool. HPA is a capacity tool. They solve different problems, and the cleanest Kubernetes setups let each one own the thing it is good at.

Use VPA to replace resource guesses with observed CPU and memory needs. Use HPA when the workload needs more or fewer copies to handle demand. Run them together when HPA follows an independent demand signal such as queue depth or requests per second.

If HPA is scaling on CPU or memory utilization, keep active VPA away from those same resources. Start VPA in recommendation mode, read what it learned, and move to automatic updates only after the numbers match what you know about the application. That small amount of patience is cheaper than debugging a pair of autoscalers arguing with each other.

---

## Further Reading

- [Kubernetes Vertical Pod Autoscaling documentation](https://kubernetes.io/docs/concepts/workloads/autoscaling/vertical-pod-autoscale/)
- [Kubernetes Horizontal Pod Autoscaling documentation](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [Upstream VPA installation and compatibility matrix](https://github.com/kubernetes/autoscaler/blob/master/vertical-pod-autoscaler/docs/installation.md)
