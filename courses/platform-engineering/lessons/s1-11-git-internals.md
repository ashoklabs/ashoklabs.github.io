---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-11-git-internals/
title: "Git Internals & Branching Strategy"
description: You deleted a branch without merging. Your teammate says it's gone. They're wrong — because you know git reflog and understand what a branch actually is. Git internals make every command make sense.
lesson_number: 11
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Git, Internals, Branching, Trunk-based Development]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-10-http2-tls/
prev_lesson_title: "HTTP/2 & TLS"
next_lesson: /courses/platform-engineering/lessons/s1-12-advanced-git/
next_lesson_title: "Advanced Git Commands"
---

## Hook

You accidentally deleted a feature branch before merging. Three days of work. Your teammate says "it's gone."

But you run `git reflog`, find the commit SHA from 3 minutes ago, and recover the entire branch in 10 seconds.

That's what understanding Git internals gives you: a safety net that most engineers don't know exists.

---

## Core Concept: Git's Object Model

Git is a content-addressable filesystem. Everything stored in `.git/objects/` is one of four object types, identified by a SHA-1 hash of their content.

### The four object types

**Blob** — stores file content. Not the filename, not the path. Just the raw bytes.

**Tree** — stores a directory snapshot: a list of (mode, filename, blob/tree SHA) entries. One tree per directory level.

**Commit** — stores:
- A reference to the root tree (snapshot of the whole project)
- Parent commit SHA(s) — the history chain
- Author, committer, timestamp, message

**Tag** — stores a named reference to another object (usually a commit).

```bash
# Walk the object graph manually
git log --oneline -1                    # get latest commit SHA
git cat-file -p <commit-sha>            # shows tree SHA, parent SHA, message
git cat-file -p <tree-sha>              # shows blob/tree entries
git cat-file -p <blob-sha>              # shows raw file content
git cat-file -t <any-sha>              # shows type: blob/tree/commit/tag
```

### What a branch actually is

A branch is a **file** in `.git/refs/heads/` containing a 40-character SHA — the commit it currently points to.

```bash
cat .git/refs/heads/main
# Output: a3f8c2d1b9e7f4a6c8d0e2b4f6a8c0d2e4f6a8c0

# A branch is literally just a file
ls -la .git/refs/heads/

# HEAD points to the current branch
cat .git/HEAD
# Output: ref: refs/heads/main
```

When you commit, Git:
1. Creates the new commit object
2. Writes the new commit SHA into `.git/refs/heads/<branch-name>`
3. HEAD follows automatically

**This explains why branches in Git are free.** Creating a branch copies a single 40-byte file. It doesn't copy your code.

### The reflog — Git's safety net

Git keeps a local log of every time HEAD or a branch pointer moved. This is called the **reflog**.

```bash
git reflog
# Output:
# a3f8c2d HEAD@{0}: commit: add rate limiting
# 7b2e1f9 HEAD@{1}: reset: moving to HEAD~1
# 9c4d3a8 HEAD@{2}: commit: fix auth bug
# 1e5f6b7 HEAD@{3}: checkout: moving from feat/old to main
```

Every operation is logged: commits, checkouts, resets, rebases. Even commits on deleted branches stay in the reflog for 30 days by default.

**Recovering a deleted branch:**
```bash
# Find the last commit SHA from the deleted branch
git reflog | grep "feat/my-feature"

# Re-create the branch
git checkout -b feat/my-feature <sha>
```

---

## Core Concept: Branching Strategy

Choosing the right branching strategy matters more than most teams realize. The wrong strategy creates merge conflicts, broken main branches, and slow releases.

### Trunk-based development — the platform engineering default

One `main` branch that is **always deployable**. All work happens in short-lived feature branches (< 2 days) that merge to main via PR.

```
main  ──●──────●──────●──────●──────→  (always deployable)
        ↑      ↑      ↑      ↑
   feat/A    fix/B  feat/C  chore/D
   (4h)     (2h)   (1 day)  (3h)
```

**Why it works for platforms:**
- You can deploy a hotfix anytime without worrying about release branches
- Short-lived branches = small PRs = faster reviews
- Forces feature flags for incomplete work (merge behind a flag, enable when ready)
- Minimal merge conflicts — the sooner you merge, the less divergence accumulates

### When GitFlow makes sense (and when it doesn't)

GitFlow has a `develop` branch, `release` branches, `hotfix` branches. It was designed for projects with scheduled, versioned releases.

**Use it if:** you ship mobile apps, on-premise software, or open-source libraries where users pin to specific versions.

**Avoid it if:** you do continuous delivery to a cloud service. GitFlow adds process overhead that actively slows down your deployment frequency.

### Feature flags — enabling trunk-based development

The reason trunk-based development works with incomplete features: feature flags.

```python
# Merge to main behind a flag — feature is invisible to users
if feature_flags.get("new-checkout-flow", user=current_user):
    return new_checkout_handler(request)
return legacy_checkout_handler(request)
```

Now you can:
- Merge partial work early (no long-lived branch divergence)
- Test in production with a subset of users
- Instant rollback: flip the flag off, no deployment needed

---

## Quick Demo

```bash
# Set up a demo repo
mkdir git-demo && cd git-demo && git init
git config user.email "you@example.com" && git config user.name "Demo"

# Create some history
echo "v1" > app.py && git add -A && git commit -m "feat: initial version"
echo "v2" > app.py && git add -A && git commit -m "feat: add feature A"
echo "v3" > app.py && git add -A && git commit -m "fix: patch bug"

# Walk the object graph
COMMIT=$(git rev-parse HEAD)
git cat-file -p $COMMIT

TREE=$(git cat-file -p $COMMIT | grep ^tree | awk '{print $2}')
git cat-file -p $TREE

BLOB=$(git cat-file -p $TREE | awk '{print $3}')
git cat-file -p $BLOB       # should print: v3

# A branch is a file
cat .git/refs/heads/main    # same as: git rev-parse main

# Simulate deleting a branch and recovering it
git checkout -b feat/experiment
echo "experiment" > exp.py && git add -A && git commit -m "feat: experiment"
BRANCH_SHA=$(git rev-parse HEAD)
git checkout main
git branch -D feat/experiment   # "deleted"

git reflog | grep experiment    # find it in reflog
git checkout -b feat/recovered $BRANCH_SHA
git log --oneline -2            # your commit is back
```

---

## Recap + Action

**Key takeaway:** A branch is a file with a SHA. The reflog logs every movement. Nothing is truly lost until `git gc` runs (30 days default). Use trunk-based development for platform teams doing continuous delivery.

**Your action:** In any existing Git repo:
```bash
cat .git/HEAD
cat .git/refs/heads/$(git branch --show-current)
git reflog | head -10
```

Find the SHA that HEAD currently points to and verify it matches the reflog's first entry.
