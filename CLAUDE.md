# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal engineering blog + paid online course platform at `ashoklabs.com`. Built on Jekyll (static site) + Cloudflare Workers (serverless backend for payments and auth).

## Development

**Local dev server (Docker):**
```bash
docker run --rm \
  -v "$PWD:/srv/jekyll" \
  -p 4000:4000 \
  jekyll/jekyll:4 \
  jekyll serve --livereload --force_polling
```

**Stop server:**
```bash
docker stop $(docker ps -q --filter ancestor=jekyll/jekyll:4)
```

**Deploy Cloudflare Worker** (from `_cloudflare/` directory):
```bash
wrangler deploy
```

There are no tests. GitHub Pages auto-builds and deploys on push to `main`.

## Architecture

### Static Site (Jekyll)
- `_config.yml` — theme (jekyll-theme-cayman), plugins, permalink structure (`/:categories/:title.html`)
- `_layouts/` — `default.html` (nav/footer wrapper), `post.html`, `course.html`, `lesson.html`
- `assets/css/custom.css` — site-wide styles; `assets/css/course-platform.css` — course/lesson UI
- `_data/issues.yml` — curated Beehiiv newsletter issues (separate from blog posts)

### Blog Posts (`_posts/`)
Named `YYYY-MM-DD-slug.md`. Required frontmatter:
```yaml
---
title: "Post Title"
categories: [category]   # also used in URL path
date: 2026-03-14
image: https://images.unsplash.com/photo-xxx?w=600&q=80
description: One-liner shown on homepage cards
---
```

### Course Platform
- Courses are Markdown pages using `layout: course` with `course_id`, `price`, `original_price`, etc.
- Lessons live under `courses/{course_id}/lessons/` using `layout: lesson`
- `_includes/razorpay-checkout.html` — inline payment UI injected into course pages

### Cloudflare Worker (`_cloudflare/worker.js`)
Handles all dynamic backend logic via `/api/*` routes:
- **Payments:** Razorpay order creation + webhook verification → writes access record to Cloudflare KV
- **Auth:** GitHub OAuth flow
- **Access control:** `/check-access` endpoint called by Cloudflare Zero Trust Access to gate lesson pages
- **Progress tracking:** lesson completion stored in KV per user

Secrets managed via `wrangler secret put`: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GITHUB_CLIENT_SECRET`.

### Access Control Flow
1. User purchases course → Worker creates Razorpay order, receives webhook → stores `{email}: true` in KV namespace `COURSE_ACCESS`
2. User logs in via GitHub OAuth (Worker handles callback)
3. Cloudflare Zero Trust Access policy calls Worker's `/check-access` endpoint before serving lesson pages
4. Lesson progress tracked via Worker API calls from frontend JS in `lesson.html`
