---
title: "Docker Tutorial for Beginners — Everything You Need to Start"
categories: [docker, devops]
date: 2026-04-19
image: https://images.unsplash.com/photo-1605745341112-85968b19335b?w=600&q=80
description: A complete Docker tutorial for beginners — containers, images, Dockerfiles, Compose, and the production practices most tutorials skip.
---

# Docker Tutorial for Beginners — Everything You Need to Start

**Primary keyword:** Docker tutorial for beginners
**Secondary keywords:** learn Docker basics, Docker containers explained, Dockerfile tutorial, Docker Compose tutorial

---

## Introduction

Docker changed how software is built and deployed. The idea is simple: package your application and everything it needs to run into a single, portable unit (a container) that runs identically everywhere — on your laptop, in CI, in production. Learning Docker is one of the highest-leverage things you can do early in a DevOps career. This tutorial covers everything from first principles: what containers are, how to build images, how to write a Dockerfile, and how to use Docker Compose for multi-service setups.

---

## Containers vs Virtual Machines

Before Docker, the standard unit of deployment was a virtual machine — a full operating system running on virtualized hardware. Containers are different: they share the host operating system's kernel and isolate only the application and its dependencies. The result is much lighter and faster.

```
Virtual Machine:                 Container:
┌──────────────────────┐         ┌──────────────────────┐
│ App                  │         │ App                  │
│ App Libraries        │         │ App Libraries        │
│ Guest OS (full)      │         ├──────────────────────┤
│ Hypervisor           │         │ Docker Engine        │
│ Host Hardware        │         │ Host OS (shared)     │
└──────────────────────┘         │ Host Hardware        │
Size: GBs, minutes to boot       └──────────────────────┘
                                 Size: MBs, seconds to start
```

Containers are not as isolated as VMs (they share the kernel), but they're much more efficient for application deployment.

---

## Installing Docker and Running Your First Container

```bash
# Install Docker Desktop (macOS/Windows) or Docker Engine (Linux)
# See docs.docker.com/get-docker for your platform

# Verify installation
docker --version

# Run your first container
docker run hello-world

# Run an interactive Ubuntu container
docker run -it ubuntu:22.04 /bin/bash
# You're now inside a container! Try: ls, pwd, cat /etc/os-release
# Exit with: exit
```

The `docker run` command does three things if the image doesn't exist locally: pulls it from Docker Hub, creates a container, and starts it.

---

## Core Docker Concepts

### Images and Containers

An **image** is a read-only template — the packaged application and its dependencies. A **container** is a running instance of an image.

```bash
# List images on your machine
docker images

# Pull an image without running it
docker pull nginx:1.25

# Run a container from an image
docker run -d -p 8080:80 --name my-nginx nginx:1.25
# -d: run in background (detached)
# -p 8080:80: map port 8080 on host to port 80 in container
# --name: give it a name

# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop and remove a container
docker stop my-nginx
docker rm my-nginx
```

Open `http://localhost:8080` in your browser — you're serving nginx from inside a container.

### Container Lifecycle Commands

```bash
# View logs from a running container
docker logs my-nginx
docker logs -f my-nginx   # follow (live)

# Execute a command inside a running container
docker exec -it my-nginx /bin/bash
docker exec my-nginx cat /etc/nginx/nginx.conf

# Inspect container details (IP, mounts, env vars)
docker inspect my-nginx

# Copy files between host and container
docker cp myfile.txt my-nginx:/tmp/
docker cp my-nginx:/etc/nginx/nginx.conf ./nginx-backup.conf
```

---

## Writing a Dockerfile

A Dockerfile defines how to build your application image. Here's a Python Flask app:

```dockerfile
# Start from an official Python base image
FROM python:3.12-slim

# Set working directory inside the container
WORKDIR /app

# Copy dependency file first (better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Don't run as root — security best practice
RUN adduser --disabled-password appuser
USER appuser

# Tell Docker which port the app listens on (documentation only)
EXPOSE 5000

# Command to start the application
CMD ["python", "app.py"]
```

```bash
# Build the image
docker build -t myapp:v1.0.0 .

# Run it
docker run -p 5000:5000 myapp:v1.0.0

# Build with a specific Dockerfile
docker build -f Dockerfile.prod -t myapp:prod .
```

### Dockerfile Best Practices

**Order matters for caching.** Docker caches each instruction layer. Copy files that change less frequently (like `requirements.txt`) before files that change more (like your source code). This way, a code change doesn't invalidate the dependency install layer.

**Use specific base image versions.** `FROM python:3.12-slim` not `FROM python:latest`. Latest changes under you; a specific version is reproducible.

**Minimize layers.** Combine `RUN` commands with `&&` and clean up in the same layer:

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

---

## Multi-Stage Builds — The Production Standard

Multi-stage builds let you use a full build environment to compile your app and then copy only the result into a minimal runtime image.

```dockerfile
# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/myapp ./...

# Stage 2: Runtime (much smaller image)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /out/myapp /usr/local/bin/myapp
USER 1001:1001
ENTRYPOINT ["/usr/local/bin/myapp"]
```

```bash
docker build -t myapp:v1.0.0 .
docker images myapp   # compare size vs single-stage build
```

The final image contains only the compiled binary and the distroless base — no Go compiler, no shell, no package manager. Typical size: 5-20 MB vs 300+ MB for a full build image.

---

## Docker Compose — Multi-Service Local Development

Most applications have dependencies: a database, a cache, a message queue. Docker Compose lets you define and run multi-container applications with a single file.

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app   # mount code for live reloading in development

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data   # persist data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
```

```bash
# Start everything
docker compose up -d

# View logs from all services
docker compose logs -f

# View logs from one service
docker compose logs -f web

# Rebuild after code changes
docker compose up -d --build web

# Stop everything
docker compose down

# Stop and remove volumes (database data)
docker compose down -v
```

The `depends_on` with `condition: service_healthy` ensures your app only starts once the database is ready — preventing the common "database not available yet" startup error.

---

## Environment Variables and Secrets

Never hardcode secrets in your Dockerfile or Compose file.

```yaml
# docker-compose.yml — load from .env file
services:
  web:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - API_KEY=${API_KEY}
```

```bash
# .env file (never commit this to Git)
DATABASE_URL=postgresql://user:password@db:5432/myapp
API_KEY=my-secret-api-key
```

Docker Compose automatically reads `.env` files in the same directory. Add `.env` to your `.gitignore`.

---

## Useful Docker Commands Cheat Sheet

```bash
# Image management
docker images                       # list images
docker rmi myapp:v1.0.0             # remove image
docker image prune                  # remove dangling images
docker system prune -a              # remove everything unused (careful!)

# Container management
docker ps -a                        # all containers
docker stats                        # live resource usage
docker top mycontainer              # processes inside container

# Network
docker network ls                   # list networks
docker network inspect bridge       # inspect default bridge network

# Volumes
docker volume ls                    # list volumes
docker volume inspect myvolume      # inspect volume details
```

---

## What's Next After Docker Basics

Once you're comfortable with Docker and Compose, the natural progression is:

1. **Kubernetes** — orchestrate containers at scale, across multiple hosts
2. **Container registries** — push your images to GHCR, Docker Hub, or ECR
3. **CI/CD integration** — automate builds and pushes with GitHub Actions
4. **Container security** — image scanning with Trivy, non-root users, read-only filesystems

---

## Conclusion

Docker is foundational to modern DevOps. Once you can containerize an application, write a clean Dockerfile, and orchestrate a multi-service setup with Compose, you have the foundation that makes Kubernetes, CI/CD pipelines, and cloud deployments make sense. Build something real with it — containerize a project you care about — and the concepts will solidify faster than any tutorial can teach.

---

**Want hands-on Docker and Kubernetes labs as part of a structured DevOps curriculum?** Everything is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
