---
title: "Ansible for DevOps Engineers — When to Use It and How to Get Started"
categories: [devops, ansible]
date: 2026-04-25
image: https://images.unsplash.com/photo-1569017388730-020b5f80a004?w=600&q=80
description: Ansible automates server configuration without agents or custom code. Here's when it makes sense, how it works, and what to build with it as a DevOps engineer.
---

# Ansible for DevOps Engineers — When to Use It and How to Get Started

**Primary keyword:** Ansible for DevOps engineers
**Secondary keywords:** Ansible tutorial beginners, Ansible vs Terraform, Ansible playbook example, configuration management DevOps

---

## Introduction

Ansible occupies a specific niche in the DevOps toolbox: configuration management. While Terraform provisions infrastructure (creates and manages cloud resources), Ansible configures what's already running — installs packages, manages users, deploys application configuration, runs maintenance tasks. It uses SSH and Python (no agents required), YAML playbooks for task definitions, and an idempotent execution model where running the same playbook twice produces the same result. This guide covers when Ansible makes sense, how it works, and how to get productive with it quickly.

---

## Ansible vs Terraform — Understanding the Difference

This is the most common confusion for engineers entering DevOps.

**Terraform** is for infrastructure provisioning. It creates and manages cloud resources: EC2 instances, VPCs, databases, Kubernetes clusters. It manages lifecycle — creation, modification, and deletion.

**Ansible** is for configuration management. Given a running server, it configures it: installs nginx, writes the nginx config, starts the service, creates application users, deploys files. It manages state within a machine.

They're complementary, not competing:

```
Terraform creates the server → Ansible configures it
```

In a Kubernetes-native environment, Ansible's role shrinks (containers handle configuration), but it remains valuable for: managing bare-metal nodes, configuring Kubernetes nodes at OS level, managing infrastructure that predates containerization, and automating operational tasks across server fleets.

---

## How Ansible Works

**No agents.** Ansible connects over SSH (or WinRM for Windows). The only requirement on managed hosts is Python (present on virtually every Linux server).

**Push model.** You run playbooks from your control machine. Ansible connects to target hosts, executes tasks, and reports results.

**Idempotent.** Tasks are designed to produce the same outcome on every run. "Ensure nginx is installed" installs it if absent, does nothing if already present. "Ensure the service is running" starts it if stopped, does nothing if already running. Running a playbook twice is safe.

---

## Getting Started — Install and Configure

```bash
# Install Ansible (macOS)
brew install ansible

# Install Ansible (Ubuntu/Debian)
pip install ansible --break-system-packages

# Verify installation
ansible --version
```

### The Inventory — Your List of Hosts

Ansible needs to know which hosts to manage. An inventory file (static or dynamic) defines them.

```ini
# inventory.ini

[webservers]
web1.example.com
web2.example.com ansible_user=ubuntu

[databases]
db1.example.com ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/prod.pem

[production:children]  # group of groups
webservers
databases

[all:vars]  # variables for all hosts
ansible_python_interpreter=/usr/bin/python3
```

Test connectivity to all hosts:

```bash
ansible all -i inventory.ini -m ping
```

---

## Your First Playbook

A **playbook** is a YAML file describing a sequence of tasks to run on target hosts.

```yaml
# deploy-nginx.yml
---
- name: Configure web servers
  hosts: webservers
  become: true   # run as sudo

  vars:
    nginx_port: 80
    app_user: webapp

  tasks:
  - name: Update apt cache
    apt:
      update_cache: yes
      cache_valid_time: 3600

  - name: Install nginx
    apt:
      name: nginx
      state: present

  - name: Create application user
    user:
      name: "{{ app_user }}"
      system: yes
      shell: /bin/false

  - name: Write nginx config
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/sites-available/myapp
      owner: root
      group: root
      mode: '0644'
    notify: Reload nginx   # triggers handler

  - name: Enable site
    file:
      src: /etc/nginx/sites-available/myapp
      dest: /etc/nginx/sites-enabled/myapp
      state: link

  - name: Ensure nginx is running and enabled
    service:
      name: nginx
      state: started
      enabled: yes

  handlers:
  - name: Reload nginx
    service:
      name: nginx
      state: reloaded
```

```bash
# Run the playbook
ansible-playbook -i inventory.ini deploy-nginx.yml

# Dry run (check mode — shows what would change without changing it)
ansible-playbook -i inventory.ini deploy-nginx.yml --check

# Run only on specific hosts
ansible-playbook -i inventory.ini deploy-nginx.yml --limit web1.example.com
```

---

## Jinja2 Templates

The `template` module renders Jinja2 templates on the control machine and copies the result to managed hosts. This lets you generate config files with host-specific or environment-specific values.

```nginx
# templates/nginx.conf.j2
server {
    listen {{ nginx_port }};
    server_name {{ inventory_hostname }};

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    access_log /var/log/nginx/{{ app_user }}-access.log;
}
```

`{{ inventory_hostname }}` is automatically populated with the host's name from the inventory. `{{ nginx_port }}` and `{{ app_user }}` come from the playbook vars section.

---

## Ansible Roles — Organizing Complex Playbooks

As playbooks grow, roles provide structure. A role is a reusable, self-contained set of tasks, templates, and variables for a specific function (nginx, postgresql, app deployment).

```
roles/
  nginx/
    tasks/
      main.yml      # tasks list
    templates/
      nginx.conf.j2
    defaults/
      main.yml      # default variable values
    handlers/
      main.yml      # handlers
    meta/
      main.yml      # role dependencies
```

Using a role in a playbook:

```yaml
---
- name: Configure web servers
  hosts: webservers
  become: true
  roles:
  - nginx
  - { role: myapp, app_version: "2.3.1" }
```

Ansible Galaxy is the community role registry:

```bash
# Install a community role
ansible-galaxy install geerlingguy.nodejs

# Install multiple roles from a requirements file
ansible-galaxy install -r requirements.yml
```

---

## Dynamic Inventories

For cloud environments where hosts are created and destroyed by Terraform or auto-scaling, static inventory files don't work. Dynamic inventories query the cloud API directly.

```bash
# AWS dynamic inventory
pip install boto3

# Create aws_ec2.yml
cat <<EOF > aws_ec2.yml
plugin: amazon.aws.aws_ec2
regions:
  - us-east-1
filters:
  tag:Environment: production
keyed_groups:
  - key: tags.Role
    prefix: role
EOF

# Use it
ansible-inventory -i aws_ec2.yml --list
ansible all -i aws_ec2.yml -m ping
```

Hosts are discovered automatically based on tags — when new EC2 instances are launched with `Environment: production`, Ansible picks them up without manual inventory updates.

---

## Practical Use Cases for Ansible in Modern DevOps

Even in Kubernetes-heavy environments, Ansible is useful for:

**Kubernetes node bootstrapping** — install container runtime, kubeadm, kubelet on bare-metal nodes before joining a cluster.

**Secrets rotation** — rotate credentials across multiple servers or services programmatically.

**Scheduled maintenance** — patch operating systems, rotate logs, clean up temporary files across server fleets.

**Infrastructure not in containers** — legacy applications, databases running on VMs, monitoring agents, VPN configurations.

**One-off operational tasks** — "restart nginx on all web servers" or "update the app config on production servers" with a one-line ad-hoc command:

```bash
# Ad-hoc: restart nginx on all web servers
ansible webservers -i inventory.ini -m service -a "name=nginx state=restarted" --become

# Ad-hoc: run a shell command on all hosts
ansible all -i inventory.ini -m shell -a "df -h"
```

---

## Conclusion

Ansible's strength is its simplicity and agentless architecture. SSH in, run tasks idempotently, exit. No daemon, no custom protocol, no complex setup on managed hosts. In a container-native environment it's not your primary IaC tool (Terraform is), but it remains highly relevant for OS-level configuration, bare-metal management, and operational automation that doesn't fit neatly into container orchestration. Learn it alongside Terraform and Kubernetes — the three together cover most of what modern DevOps infrastructure management requires.

---

**Want to build configuration management skills as part of a full DevOps curriculum?** Everything is at ashoklabs.com.

**[Explore the courses →](https://ashoklabs.com/courses)**
