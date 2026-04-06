---
title: "Python for DevOps Engineers — What You Actually Need to Learn"
categories: [devops, python]
date: 2026-04-17
image: https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=600&q=80
description: You don't need to be a Python expert to use it effectively in DevOps. Here's the specific Python knowledge that actually comes up in infrastructure and automation work.
---

# Python for DevOps Engineers — What You Actually Need to Learn

**Primary keyword:** Python for DevOps engineers
**Secondary keywords:** Python DevOps scripting, Python automation DevOps, DevOps Python skills

---

## Introduction

Python is the most useful programming language for DevOps work — not because of its elegance, but because it runs everywhere, has libraries for everything, and strikes the right balance between "quick script" and "maintainable automation." You don't need to master Python data structures or algorithms to use it effectively in infrastructure work. What you need is a focused subset: file and process handling, HTTP requests, JSON parsing, Kubernetes and cloud SDK usage, and enough structure to write scripts that don't become maintenance nightmares. This guide covers exactly that.

---

## The Basics You Need Cold

### Variables, Functions, and Control Flow

```python
# Variables are dynamically typed
environment = "production"
replica_count = 3
is_healthy = True

# Functions with default arguments
def get_pod_count(namespace, label_selector="app=myapp"):
    # returns int
    pass

# Control flow
if environment == "production":
    min_replicas = 3
elif environment == "staging":
    min_replicas = 1
else:
    min_replicas = 1

# Loops
namespaces = ["default", "staging", "production"]
for ns in namespaces:
    print(f"Checking namespace: {ns}")

# List comprehension — common in DevOps scripts
healthy_pods = [p for p in pods if p["status"] == "Running"]
```

### Error Handling

Production scripts must handle errors gracefully. A script that crashes with an unhandled exception at 2am is worse than one that handles the failure and logs it.

```python
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

def deploy(image_tag: str) -> bool:
    try:
        # deployment logic
        logger.info(f"Deploying image: {image_tag}")
        return True
    except ConnectionError as e:
        logger.error(f"Failed to connect to Kubernetes API: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during deploy: {e}")
        raise  # re-raise unexpected errors — don't swallow them

if not deploy("myapp:abc123"):
    logger.error("Deployment failed, exiting")
    sys.exit(1)
```

---

## Working With Files and Configuration

### Reading and Writing Files

```python
import json
import yaml  # pip install pyyaml

# Read JSON config
with open("config.json") as f:
    config = json.load(f)

db_host = config["database"]["host"]

# Read YAML (common for Kubernetes manifests)
with open("deployment.yaml") as f:
    manifest = yaml.safe_load(f)

# Write JSON output
with open("results.json", "w") as f:
    json.dump({"status": "deployed", "version": "1.2.3"}, f, indent=2)

# Read environment variables with defaults
import os
db_password = os.environ.get("DB_PASSWORD")
if not db_password:
    raise ValueError("DB_PASSWORD environment variable is required")

environment = os.environ.get("ENVIRONMENT", "dev")  # default to "dev"
```

### Path Handling

```python
from pathlib import Path

# Modern Python path handling
config_dir = Path.home() / ".config" / "myapp"
config_dir.mkdir(parents=True, exist_ok=True)

config_file = config_dir / "config.json"
if config_file.exists():
    config = json.loads(config_file.read_text())
```

---

## Running Shell Commands

DevOps Python scripts often need to run shell commands. Use `subprocess` — not `os.system()`.

```python
import subprocess

# Run a command and get output
result = subprocess.run(
    ["kubectl", "get", "pods", "-n", "production", "-o", "json"],
    capture_output=True,
    text=True,
    check=False  # don't raise on non-zero exit
)

if result.returncode != 0:
    print(f"kubectl failed: {result.stderr}")
    sys.exit(1)

pods = json.loads(result.stdout)

# Run a command and let output stream to terminal
subprocess.run(
    ["terraform", "apply", "-auto-approve"],
    check=True  # raises CalledProcessError on non-zero exit
)
```

**Never use `shell=True` with user input** — it's a shell injection vulnerability. Only use `shell=True` for trusted, hardcoded commands if you need shell features like pipes.

---

## HTTP Requests and APIs

The `requests` library handles REST API calls cleanly.

```python
import requests

# GET request with auth
response = requests.get(
    "https://api.github.com/repos/myorg/myapp/releases/latest",
    headers={"Authorization": f"token {os.environ['GITHUB_TOKEN']}"},
    timeout=10  # always set a timeout
)
response.raise_for_status()  # raises HTTPError on 4xx/5xx
release = response.json()
print(f"Latest release: {release['tag_name']}")

# POST request
response = requests.post(
    "https://hooks.slack.com/services/...",
    json={"text": "Deployment complete ✓"},
    timeout=10
)
response.raise_for_status()
```

**Always set `timeout`**. A script that hangs indefinitely waiting for an HTTP response is a production issue.

---

## Working With the Kubernetes API

The official Kubernetes Python client is the right tool for automating Kubernetes operations.

```bash
pip install kubernetes
```

```python
from kubernetes import client, config

# Load kubeconfig (from ~/.kube/config or in-cluster service account)
try:
    config.load_incluster_config()  # running inside a pod
except config.ConfigException:
    config.load_kube_config()  # running locally

v1 = client.CoreV1Api()
apps_v1 = client.AppsV1Api()

# List pods in a namespace
pods = v1.list_namespaced_pod(namespace="production", label_selector="app=myapp")
for pod in pods.items:
    print(f"{pod.metadata.name}: {pod.status.phase}")

# Update a deployment's image
apps_v1.patch_namespaced_deployment(
    name="myapp",
    namespace="production",
    body={"spec": {"template": {"spec": {"containers": [
        {"name": "myapp", "image": "myapp:new-tag"}
    ]}}}}
)
```

---

## AWS and Azure SDK Usage

### AWS with boto3

```python
import boto3

# List EC2 instances
ec2 = boto3.client("ec2", region_name="us-east-1")
response = ec2.describe_instances(
    Filters=[{"Name": "tag:Environment", "Values": ["production"]}]
)

for reservation in response["Reservations"]:
    for instance in reservation["Instances"]:
        print(f"{instance['InstanceId']}: {instance['State']['Name']}")

# Upload to S3
s3 = boto3.client("s3")
s3.upload_file("backup.tar.gz", "my-backups-bucket", "2026/04/17/backup.tar.gz")
```

### Azure with azure-mgmt

```python
from azure.identity import DefaultAzureCredential
from azure.mgmt.compute import ComputeManagementClient

credential = DefaultAzureCredential()  # uses env vars or managed identity
compute_client = ComputeManagementClient(credential, subscription_id)

# List VMs
for vm in compute_client.virtual_machines.list_all():
    print(f"{vm.name}: {vm.location}")
```

---

## Writing Scripts That Are Maintainable

Scripts that start as "quick one-offs" often become critical automation. Write them as if they'll be maintained by someone who doesn't know the context.

```python
#!/usr/bin/env python3
"""
cleanup-old-images.py
Removes container images older than N days from GHCR.
Usage: python cleanup-old-images.py --days 30 --dry-run
"""

import argparse
import logging
import sys

def parse_args():
    parser = argparse.ArgumentParser(description="Clean up old container images")
    parser.add_argument("--days", type=int, default=30, help="Delete images older than N days")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    return parser.parse_args()

def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    if args.dry_run:
        logger.info("DRY RUN — no images will be deleted")

    # ... implementation

if __name__ == "__main__":
    main()
```

The patterns that matter: docstring at the top explaining what it does, `argparse` for CLI arguments (not hardcoded values), structured logging (not `print()`), and a `main()` function that's callable and testable.

---

## Useful Libraries for DevOps Python

| Library | Purpose |
|---------|---------|
| `requests` | HTTP API calls |
| `boto3` | AWS SDK |
| `azure-mgmt-*` | Azure SDKs |
| `kubernetes` | Kubernetes Python client |
| `pyyaml` | YAML parsing |
| `click` | Better CLI argument parsing than argparse |
| `rich` | Beautiful terminal output, progress bars |
| `python-dotenv` | Load `.env` files into environment |
| `tenacity` | Retry logic with backoff |

---

## Conclusion

Python in DevOps is about automation and integration — calling APIs, parsing JSON/YAML, running subprocesses, and gluing tools together. You don't need to master every Python feature. Master the fundamentals: file I/O, error handling, subprocess, HTTP requests, and the cloud/Kubernetes SDKs. Write scripts that have proper logging, handle errors explicitly, and take configuration from environment variables rather than hardcoded values. That's the Python skill level that makes you effective in an infrastructure role.

---

**Want to build Python automation skills as part of a structured DevOps curriculum?** Everything is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
