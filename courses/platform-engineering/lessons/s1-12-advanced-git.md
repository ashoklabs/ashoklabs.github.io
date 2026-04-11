---
layout: lesson
permalink: /courses/platform-engineering/lessons/s1-12-advanced-git/
title: "Advanced Git: bisect, rebase, cherry-pick"
description: A bug landed 3 weeks ago across 200 commits. git bisect finds it in 8 steps. An ugly 12-commit history becomes one clean commit before your PR merge. These commands separate good engineers from great ones.
lesson_number: 12
duration: 12 min
section_number: 1
section_title: "Engineering Foundations"
course_id: platform-engineering
course_title: Platform Engineering Bootcamp
tags: [Git, Rebase, Bisect, Cherry-pick, Advanced]

video_id: dQw4w9WgXcQ

prev_lesson: /courses/platform-engineering/lessons/s1-11-git-internals/
prev_lesson_title: "Git Internals & Branching"
next_lesson: /courses/platform-engineering/lessons/s1-13-git-hooks-gitops/
next_lesson_title: "Git Hooks & GitOps"
---

## Hook

A critical bug landed in production. It worked fine three months ago. There are 200 commits since then.

Without `git bisect`: manually checking commits one by one, guessing, reading code.

With `git bisect`: 8 binary search steps. Git checks out the middle commit, you test it, you say "good" or "bad." Repeat. After 8 steps in a 200-commit range, you have the exact commit.

These three commands — `bisect`, `rebase -i`, `cherry-pick` — belong in every platform engineer's muscle memory.

---

## Core Concept: git bisect

Binary search through commit history to find which commit introduced a bug.

### How it works

You tell Git two things:
- The current state is **bad** (broken)
- Some past commit was **good** (working)

Git calculates the midpoint, checks it out, you test, you report. Repeat until Git identifies the exact commit.

For 200 commits, this takes `log2(200) ≈ 8` steps — regardless of how far back the bug goes.

```bash
git bisect start
git bisect bad HEAD          # current = broken
git bisect good v2.1.0       # last known good tag/commit

# Git checks out a commit halfway between
# You test: run your app, run a test, check a log file

git bisect good   # if this commit is fine
# OR
git bisect bad    # if this commit is broken

# Repeat until Git says:
# "abc1234 is the first bad commit"

git bisect reset  # return HEAD to where you started
```

### Automating bisect with a script

```bash
# Your test script: exit 0 = good, non-zero = bad
cat > /tmp/test.sh << 'EOF'
#!/bin/bash
make build 2>/dev/null && ./run-test.sh
EOF
chmod +x /tmp/test.sh

git bisect start
git bisect bad HEAD
git bisect good v2.1.0
git bisect run /tmp/test.sh    # Git runs the script at each step automatically
```

---

## Core Concept: git rebase -i (interactive rebase)

Interactive rebase lets you rewrite your local commit history before sharing it. The most common use: squashing "WIP" commits into clean, reviewable commits before a PR.

```bash
# Interactively edit the last 5 commits
git rebase -i HEAD~5
```

Git opens an editor listing your commits, oldest first:
```
pick 1a2b3c4 WIP
pick 5d6e7f8 more WIP
pick 9a0b1c2 fix typo in WIP
pick 3d4e5f6 almost done
pick 7a8b9c0 feat: add payment retry logic
```

Change `pick` to squash the WIP commits into the final one:
```
pick 1a2b3c4 WIP
squash 5d6e7f8 more WIP
squash 9a0b1c2 fix typo in WIP
squash 3d4e5f6 almost done
reword 7a8b9c0 feat: add payment retry logic
```

Result: one clean commit with a well-written message.

**Operations available:**
| Command | Effect |
|---------|--------|
| `pick` | Keep commit as-is |
| `squash` | Combine with previous commit (merge messages) |
| `fixup` | Combine with previous commit (discard this message) |
| `reword` | Keep commit, edit the message |
| `drop` | Delete this commit entirely |
| `edit` | Pause rebase here — you can amend the commit |

<div class="callout callout--warn">
  <span class="callout-icon">⚠️</span>
  <div class="callout-body">
    <strong>The golden rule of rebase</strong>
    Never rebase commits that have been pushed to a shared branch. Rebase rewrites commit SHAs — anyone who pulled those commits will have a divergent history. Rebase is for local cleanup before your first push. After sharing: use <code>git revert</code>.
  </div>
</div>

---

## Core Concept: git cherry-pick

Apply a specific commit (or range) to the current branch, without merging the whole branch.

**When you use it:**
- Backporting a security patch to a release branch
- Moving a hotfix commit from a feature branch to main
- Applying one specific fix without pulling in surrounding unrelated changes

```bash
# Apply a specific commit to the current branch
git cherry-pick abc1234

# Apply a range of commits
git cherry-pick abc1234..def5678

# Cherry-pick without committing (stage the changes only)
git cherry-pick -n abc1234

# If there's a conflict
git status                    # see conflicted files
# ... resolve conflicts ...
git add .
git cherry-pick --continue    # finish the cherry-pick
```

**Real-world scenario:**
```bash
# A security patch landed on main
git log --oneline main | head -5
# a1b2c3d fix: patch SQL injection in user search   ← want this
# e4f5a6b feat: add dark mode
# ...

# Backport only the security patch to release/v3.2
git checkout release/v3.2
git cherry-pick a1b2c3d
git push origin release/v3.2
```

---

## Quick Demo

```bash
# Set up a repo with a "bug" introduced at commit 4
mkdir bisect-demo && cd bisect-demo && git init
git config user.email "you@example.com" && git config user.name "Demo"
for i in 1 2 3 4 5 6 7 8; do
  echo "version $i" > app.py
  [ $i -eq 4 ] && echo "BUG" >> app.py
  git add -A && git commit -m "version $i"
done

# Find which commit introduced BUG
git bisect start
git bisect bad HEAD
git bisect good HEAD~8
git bisect run bash -c 'grep -q "BUG" app.py && exit 1; exit 0'
# Output should identify commit 4 as the first bad commit
git bisect reset

# Practice interactive rebase
mkdir rebase-demo && cd ../rebase-demo && git init
git config user.email "you@example.com" && git config user.name "Demo"
for msg in "WIP" "more wip" "fix typo" "done"; do
  echo "$msg" >> feature.md && git add -A && git commit -m "$msg"
done
git rebase -i HEAD~4
# Squash all into one clean commit

git log --oneline   # should show one commit
```

---

## Recap + Action

**Key takeaway:** `bisect` finds bugs in log₂(n) steps. `rebase -i` cleans messy history before a PR. `cherry-pick` applies specific commits across branches. All three are standard platform engineering tools.

**Your action:** In a repo with 5+ commits, run:
```bash
git log --oneline | head -5
git bisect start
git bisect bad HEAD
git bisect good <5-commits-back-sha>
```

Step through 2-3 rounds manually. Then run `git bisect reset`.
