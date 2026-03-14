# ashoklabs.github.io

Personal site and blog built with [Jekyll](https://jekyllrb.com/) and the [Cayman theme](https://github.com/pages-themes/cayman), hosted on GitHub Pages.

## Running Locally

The easiest way is with Docker — no Ruby or Jekyll installation needed.

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
# From the repo root
docker run --rm \
  -v "$PWD:/srv/jekyll" \
  -p 4000:4000 \
  jekyll/jekyll:4 \
  jekyll serve --livereload --force_polling

docker stop $(docker ps -q --filter ancestor=jekyll/jekyll:4)

```

Then open [http://localhost:4000](http://localhost:4000).

The site auto-refreshes when you edit any file.

## Writing a Blog Post

Create a new file in `_posts/` following this naming convention:

```
_posts/YYYY-MM-DD-your-post-title.md
```

Add this frontmatter at the top, then write your content in Markdown. Notice the `categories` property: we use this to set the URL path (e.g., `/terraform/your-post-title.html`):

```markdown
---
title: "Your Post Title"
categories: [terraform]
date: 2026-03-14
image: https://images.unsplash.com/photo-xxxxx?w=600&q=80
description: A one-sentence summary shown on the homepage card.
---

Your markdown content here...
```

## Adding Newsletter Issues

The "Past Issues" list on the Newsletter page is powered by a separate data file, meaning your external Beehiiv newsletters don't mix with your standard blog posts. Provide new Beehiiv issues by editing the `_data/issues.yml` file:

```yaml
- title: "Practical plays, shipped fast 🧪"
  date: "Mar 14, 2026"
  url: "https://newsletter.ashoklabs.com/p/your-post-url"
```

## Project Structure

```
.
├── _posts/          # Blog posts (Markdown)
├── _layouts/        # HTML layout templates
├── assets/
│   └── css/
│       └── custom.css   # Custom styles
├── _config.yml      # Jekyll + theme config
└── index.md         # Homepage
```

## Deploying

Push to the `main` branch — GitHub Pages builds and deploys automatically.

```bash
git add .
git commit -m "Add new post"
git push
```
