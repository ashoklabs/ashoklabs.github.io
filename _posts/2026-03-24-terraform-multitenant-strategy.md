---
title: "Terraform enterprise strategy for multi-tenant customers"
categories: [terraform, devops]
date: 2026-03-24
image: https://i.imghippo.com/files/SnL5040kIU.webp
description: How I think about module structure, state isolation, layered provisioning, and feature flags when running Terraform across multiple customers.
---

# Terraform enterprise strategy for multi-tenant customers

The monorepo vs multi-repo debate for Terraform modules never really dies. My answer: it depends, and a hybrid often works better than picking a side.

If your teams share common modules to avoid repeating the same work across codebases, separating those modules into their own repo makes sense. But if there's no meaningful cross-team sharing happening, a monorepo with a clear module folder structure is simpler — less coordination overhead, easier to track changes. My default is to keep my own modules as subfolders within the same repo and reference them locally. If shared modules start showing up across multiple teams, that's when I'd split them out.

## State isolation per customer and environment

For multi-tenant setups, workspaces give you clean boundaries between environments. Each customer and each runtime gets its own identity for `plan` and `apply`. This keeps dev work from touching production state, and it makes the security model easy to reason about: a pipeline with permission to run `plan` in dev has no path to a customer's production state.

## CI/CD and parallel development

The pipeline is set up so dev branches can only target test environments. This matters more than it sounds. It means IAC development can happen in parallel with customer releases — you're not holding a feature back waiting for a release window, and you're not risking untested infrastructure changes going to a live customer.

## Provisioning in layers

When you're standing up an entire customer's infrastructure, don't try to do it in a single root module. Break it into layers, with each layer as a separate apply:

- Identities
- Storage accounts
- Compute
- VNets
- Application layer
- Observability

The order matters. Identities come first because almost everything else depends on them. Observability goes last because it wraps around everything. Each intermediate layer only needs to know about the layers below it.

The payoff is smaller blast radius per change. If you're rolling out an update to compute configuration, you're not touching networking or observability in the same apply. Debugging is also cleaner — when something fails, you know which layer it's in.

## Feature flags with count and for_each

This is probably the most underused pattern I see in multi-tenant Terraform. You can gate infrastructure features per customer using `count` or `for_each` on a boolean variable:

```hcl
variable "enable_advanced_monitoring" {
  type    = bool
  default = false
}

resource "azurerm_monitor_diagnostic_setting" "advanced" {
  count = var.enable_advanced_monitoring ? 1 : 0
  # ...
}
```

Set it to `true` in one customer's `tfvars`, leave it `false` for everyone else. Once you've validated the feature works across a few customers without issues, flip the default to `true` and it rolls out to the rest on their next apply.

No code branches. No separate modules per customer. The same codebase handles everyone, with controlled rollout built in.

---

If you found this useful, I write about Terraform, platform engineering, and DevOps patterns regularly. Subscribe to the newsletter and get new posts straight to your inbox.

[Subscribe to the newsletter](https://ashoklabs.com/newsletter)
