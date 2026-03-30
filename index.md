---
layout: default
title: Ashoklabs
---

<div class="home-hero">
  <div class="home-hero__text">
    <p class="home-hero__greeting">Hi, I'm Ashok</p>
    <h1 class="home-hero__name">Senior DevOps &amp;<br>Platform Engineer</h1>
    <p class="home-hero__bio">10 years designing and operating production infrastructure on Azure and AWS. I write practical guides on Terraform, Kubernetes, platform engineering, and AI-assisted DevOps — the kind I wished existed when I was learning.</p>
    <div class="home-hero__creds">
      <span class="home-hero__cred">Azure DevOps Expert</span>
      <span class="home-hero__cred">Solution Architect</span>
      <span class="home-hero__cred">10 yrs experience</span>
    </div>
    <div class="home-hero__actions">
      <a href="{{ '/newsletter' | relative_url }}" class="home-hero__cta-primary">Get the Newsletter</a>
      <a href="{{ '/courses/platform-engineering' | relative_url }}" class="home-hero__cta-secondary">See the Bootcamp</a>
    </div>
  </div>
  <div class="home-hero__photo-wrap">
    <img class="home-hero__photo" src="{{ site.author.avatar }}" alt="{{ site.author.name }}" width="140" height="140" loading="eager">
  </div>
</div>

<div class="home-posts-section">
  <div class="home-section-hdr">
    <h2 class="home-section-title">Latest Posts</h2>
    <a href="{{ '/blog' | relative_url }}" class="home-section-link">View all &rarr;</a>
  </div>

  <div class="post-list">
  {% for post in site.posts limit: 3 %}
    <a class="post-card" href="{{ post.url }}">
      {% if post.image %}
      <img class="post-card-image" src="{{ post.image }}" alt="{{ post.title }}" loading="lazy">
      {% else %}
      <div class="post-card-image post-card-placeholder"></div>
      {% endif %}
      <div class="post-card-body">
        <p class="post-card-title">{{ post.title }}</p>
        <p class="post-card-desc">{{ post.description }}</p>
        <div class="post-card-foot">
          {% if post.categories.size > 0 %}<span class="post-card-cat">{{ post.categories[0] | capitalize }}</span>{% endif %}
          <span class="post-card-date">{{ post.date | date: "%b %d, %Y" }}</span>
          <span class="post-card-read">{{ post.content | number_of_words | divided_by: 200 | plus: 1 }} min read</span>
        </div>
      </div>
    </a>
  {% endfor %}
  </div>
</div>

<div class="home-course-card">
  <div class="home-course-card__badge">New Course</div>
  <h3 class="home-course-card__title">AI-Augmented Platform Engineering Bootcamp</h3>
  <p class="home-course-card__desc">16 weeks of hands-on Terraform, Kubernetes, GitOps, and AI-assisted operations. Build a complete internal developer platform. Early access — 50% off launch price.</p>
  <a href="{{ '/courses/platform-engineering' | relative_url }}" class="home-course-card__link">See the Bootcamp &rarr;</a>
</div>
