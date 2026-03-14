---
title: "Terraform Best Practices for Team Environments"
categories: [terraform]
date: 2026-03-01
image: https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&q=80
description: Remote state, module versioning, variable validation, and drift detection — what it actually takes to run Terraform in a team.
---

# Terraform Best Practices for Team Environments

Terraform is fantastic for managing infrastructure as code — until you're working in a team and someone runs `terraform apply` from their laptop with stale state. Here's how to avoid the pitfalls.

## Remote State is Non-Negotiable

Local state files are a liability. Use remote state from day one.

```hcl
terraform {
  backend "s3" {
    bucket         = "mycompany-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

The DynamoDB table provides state locking — only one `apply` can run at a time. Without it, two engineers running apply simultaneously can corrupt your state file.

## Separate State per Environment

Never mix dev and production state. Use separate backends:

```
infrastructure/
  environments/
    dev/
      main.tf
      backend.tf   # points to dev state bucket
    staging/
      main.tf
      backend.tf
    production/
      main.tf
      backend.tf
  modules/
    vpc/
    eks-cluster/
    rds/
```

## Module Versioning

Pin your module versions — always.

```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"   # never use ">= 5.0" in production

  name = "my-vpc"
  cidr = "10.0.0.0/16"
}
```

## Variable Validation

Catch mistakes at plan time, not apply time.

```hcl
variable "environment" {
  type        = string
  description = "Deployment environment"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "instance_count" {
  type    = number
  default = 1

  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 20
    error_message = "Instance count must be between 1 and 20."
  }
}
```

## Always Plan Before Apply in CI

```bash
# In your CI pipeline
terraform init
terraform validate
terraform plan -out=tfplan
# Human review step here
terraform apply tfplan
```

The `-out=tfplan` ensures the apply executes exactly what was reviewed, not a new plan generated moments later.

## Drift Detection

Infrastructure drifts when someone makes a manual change in the console. Run `terraform plan` on a schedule to detect drift:

```yaml
# GitHub Actions scheduled job
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9am
jobs:
  drift-check:
    steps:
      - run: terraform plan -detailed-exitcode
```

Exit code `2` means drift was detected — alert your team.
