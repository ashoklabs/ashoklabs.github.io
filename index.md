---
layout: default
title: Ashoklabs
---

<div class="home-intro">
  <p class="home-intro__label">Engineering Blog</p>
  <p class="home-intro__text">Practical guides on Terraform, Kubernetes, platform engineering, and AI-assisted DevOps — written by a practitioner, not a content team.</p>
</div>

<div class="post-list">
{% for post in site.posts %}
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
