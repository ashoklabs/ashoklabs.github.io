---
title: "Kubernetes Validating Admission Policies: Webhook-Free Guardrails"
categories: [kubernetes, devops, security]
date: 2026-07-11
image: https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=600&q=80
description: Stop running complex admission webhooks. Learn how to write, bind, and scale native ValidatingAdmissionPolicies using CEL to secure your Kubernetes cluster.
---

# Kubernetes Validating Admission Policies: Secure Your Clusters Webhook-Free

**Meta description:** Enforce Kubernetes guardrails natively. Learn how to build, bind, and scale ValidatingAdmissionPolicy using Common Expression Language (CEL) without writing validation webhooks.

**Primary keyword:** Kubernetes ValidatingAdmissionPolicy CEL
**Secondary keywords:** validating admission controller, webhook-free validation, Kubernetes policy-as-code, CEL expressions

---

## Introduction

Historically, enforcing custom security guardrails or schema constraints in Kubernetes meant running admission webhooks. If you wanted to block container images using the `:latest` tag, or require a `billing-code` label on every Namespace, you had to deploy and maintain custom webhook servers or run third-party policy engines like OPA Gatekeeper or Kyverno.

While webhooks are powerful, they come with substantial operational tax: they add latency to API requests, introduce networking complexity, and pose a severe availability risk. If your webhook server goes down or suffers from latency spikes, your entire control plane can lock up. 

Since Kubernetes 1.30, **ValidatingAdmissionPolicy (VAP)** has reached General Availability (GA). VAP allows you to declare custom validation rules directly in native Kubernetes resources using **Common Expression Language (CEL)**. Because these rules are evaluated in-process by the API server itself, you get the security of policy-as-code with zero webhook overhead, zero extra network hops, and no infrastructure to maintain.

This guide walks you through writing, binding, and parameterizing ValidatingAdmissionPolicies in production.

---

## Webhooks vs. ValidatingAdmissionPolicy: The Architectural Shift

Before diving into YAML, it is important to understand *why* ValidatingAdmissionPolicy is such a significant upgrade over webhook-based architectures.

| Feature | Admission Webhooks (Gatekeeper, Kyverno, Custom) | ValidatingAdmissionPolicy (VAP) |
|---|---|---|
| **Execution** | Out-of-process HTTPS call (Network hop) | In-process execution within the API Server |
| **Latency** | High (tens or hundreds of milliseconds) | Minimal (sub-millisecond evaluation) |
| **Failure Modes** | Network timeouts, SSL cert expiry, webhook server downtime | None (failsafe evaluation managed by apiserver) |
| **Operational Tax** | High (deployments, cert-manager, load balancers, monitoring) | Zero (defined as a CRD, evaluated natively) |
| **Policy Language** | Rego, Custom CRD schemas, Go code | Common Expression Language (CEL) |

By embedding the Common Expression Language engine directly into the Kubernetes API server, VAP guarantees sub-millisecond evaluation of policies without leaving the control plane memory space.

---

## Writing Your First ValidatingAdmissionPolicy

A native Kubernetes policy is split into two components:
1. **`ValidatingAdmissionPolicy`**: Defines *what* resources to inspect and the *rules* (CEL expressions) to evaluate.
2. **`ValidatingAdmissionPolicyBinding`**: Defines *where* and *how* to apply the policy (e.g., scoping to specific namespaces, excluding system namespaces, and defining the action to take upon failure).

Let's write a policy that enforces two common production rules:
1. Containers must not use the `:latest` tag.
2. Container `imagePullPolicy` must be set to `Always` or `IfNotPresent` (blocking `Never` in production).

Create a file named `policy-image-checks.yaml`:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: "enforce-image-standards"
spec:
  failurePolicy: Fail # Fail or Ignore when policy evaluation errors
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
  variables:
    - name: containers
      expression: "object.spec.containers + object.spec.initContainers"
  validations:
    - expression: "variables.containers.all(c, !c.image.endsWith(':latest'))"
      message: "Using the ':latest' image tag is forbidden in this cluster."
    - expression: "variables.containers.all(c, has(c.imagePullPolicy) ? c.imagePullPolicy in ['Always', 'IfNotPresent'] : true)"
      message: "imagePullPolicy must be 'Always' or 'IfNotPresent'."
```

### Breaking Down the CEL Expressions

Let's dissect the components of this policy:
- **`matchConstraints`**: Specifies that this policy targets Pod creation and updates.
- **`variables`**: Simplifies the validations. Instead of repeating the concatenation of normal containers and init containers, we define a helper variable `variables.containers`.
- **`validations.expression`**: Uses CEL to validate conditions:
  - `variables.containers.all(c, ...)` iterates through all containers and checks that the condition is met for *all* elements.
  - `!c.image.endsWith(':latest')` returns `true` only if the image string does not end with `:latest`.
  - `has(c.imagePullPolicy)` checks if the field is defined. If it is, we check if its value is in our allowed set using `in`.

---

## Binding the Policy to a Cluster

A policy definition does nothing by itself. To activate it, you must bind it to a scope using a `ValidatingAdmissionPolicyBinding`.

Let's apply this policy to all namespaces *except* system namespaces (like `kube-system` and `kube-public`).

Create a file named `binding-image-standards.yaml`:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: "enforce-image-standards-binding"
spec:
  policyName: "enforce-image-standards"
  validationActions: [Deny] # Deny, Warn, or Audit
  matchResources:
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values: ["kube-system", "kube-public", "kube-node-lease"]
```

### Validation Actions
The `validationActions` field lets you control how violations are handled:
- **`Deny`**: Instantly rejects the API request and returns the configured message to the user.
- **`Warn`**: Allows the request to succeed but returns a warning header to the client (highly useful for transitioning teams onto new policies without breaking CI/CD pipelines).
- **`Audit`**: Logs the validation failure to the API server audit log without affecting the request outcome.

Apply both manifests to your cluster:

```bash
kubectl apply -f policy-image-checks.yaml
kubectl apply -f binding-image-standards.yaml
```

---

## Testing the Policy

Let's verify the validation rules by attempting to deploy a Pod that violates our standards.

Create a temporary Pod manifest `invalid-pod.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-invalid-pod
  namespace: default
spec:
  containers:
    - name: nginx
      image: nginx:latest # Violation 1
      imagePullPolicy: Never # Violation 2
```

Attempt to create the Pod:

```bash
kubectl apply -f invalid-pod.yaml
```

You should see an error response similar to:

```
Error from server (Forbidden): error when creating "invalid-pod.yaml": pods "test-invalid-pod" is forbidden: ValidatingAdmissionPolicy 'enforce-image-standards' with binding 'enforce-image-standards-binding' denied request: 
- Using the ':latest' image tag is forbidden in this cluster.
- imagePullPolicy must be 'Always' or 'IfNotPresent'.
```

The API server successfully intercepted the invalid request at admission time without forwarding it to the scheduler or hitting a external webhook endpoint.

---

## Parameterized Policies: Reusable Guardrails

One of the limitations of simple CEL policies is that values (such as prohibited namespaces or allowed tags) are hardcoded. If you want to apply the same policy template across dev and production but with different configurations, you would have to write multiple duplicates.

Fortunately, VAP supports **parameterization**. You can link your policy to a custom configuration Resource (usually a custom resource definition or a ConfigMap) and reference those parameters within your CEL expressions.

For example, let's design a policy that limits the maximum replica count of Deployments, but reads the limits from a parameter resource.

First, define the parameters schema as a CustomResourceDefinition:

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: replicacontrols.policy.ashoklabs.com
spec:
  group: policy.ashoklabs.com
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            maxReplicas:
              type: integer
  scope: Namespaced
  names:
    plural: replicacontrols
    singular: replicacontrol
    kind: ReplicaControl
```

Next, write the `ValidatingAdmissionPolicy` referencing this parameter:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata:
  name: "enforce-replica-limits"
spec:
  failurePolicy: Fail
  paramKind:
    apiVersion: policy.ashoklabs.com/v1
    kind: ReplicaControl
  matchConstraints:
    resourceRules:
      - apiGroups: ["apps"]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
  validations:
    - expression: "object.spec.replicas <= params.maxReplicas"
      messageExpression: "'Deployment replicas (' + string(object.spec.replicas) + ') exceeds the configured maximum limit of ' + string(params.maxReplicas) + '.'"
```

Now, create the parameter resource specifying the limits:

```yaml
apiVersion: policy.ashoklabs.com/v1
kind: ReplicaControl
metadata:
  name: dev-limits
  namespace: dev-environment
spec:
  maxReplicas: 3
```

Finally, bind the policy to the namespace and link the parameter resource to it:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata:
  name: "enforce-replica-limits-binding"
spec:
  policyName: "enforce-replica-limits"
  validationActions: [Deny]
  paramRef:
    name: dev-limits
    namespace: dev-environment
  matchResources:
    namespaceSelector:
      matchLabels:
        environment: dev
```

If developers attempt to scale a Deployment beyond 3 replicas inside any namespace labeled with `environment: dev`, their request will be blocked immediately.

---

## When to Use Native CEL vs. Gatekeeper/Kyverno

While native `ValidatingAdmissionPolicy` is the new standard for resource validations, it is not a complete replacement for established engines like OPA Gatekeeper or Kyverno in all scenarios.

Here is how to choose:

- **Use Native CEL (`ValidatingAdmissionPolicy`) if:**
  - You are enforcing standard checks (labels, image standards, replica counts, volume limitations).
  - You want minimal overhead and sub-millisecond admission latency.
  - You want to reduce the resource usage of your control plane.
  - You want policy definitions to be standard Kubernetes manifests without maintaining external CRD tooling.

- **Use Third-Party Policy Engines if:**
  - You require **Mutation** (e.g., automatically injecting sidecars, labels, or environment variables into Pods). VAP is strictly validation-only.
  - You need to perform **External Data Lookups** (e.g., querying LDAP, Vault, or external databases during validation).
  - You need cross-resource validations that CEL cannot process (e.g., checking if an Ingress hostname conflicts with another Ingress host in a different namespace).

---

## Conclusion

Running admission webhooks in Kubernetes has always been a compromise between cluster stability and policy enforcement. By moving custom validation rules directly into the API server process, ValidatingAdmissionPolicy eliminates the operational headaches of certificates, latency, and webhook system outages.

If your cluster is running Kubernetes 1.30 or newer, start auditing your webhooks. Standard validation rules should be migrated to `ValidatingAdmissionPolicy` to simplify your control plane, reduce resource consumption, and ensure fail-safe cluster operations.

---

**Want more Kubernetes patterns and production guides?** I write about infrastructure, platform engineering, and DevOps every week. Subscribe below and get new posts straight to your inbox — no spam, unsubscribe anytime.

**[Subscribe to the newsletter →](https://ashoklabs.com/newsletter)**
