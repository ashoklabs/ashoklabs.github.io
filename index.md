---
layout: default
---

# Welcome to Ashoklabs

Notes on DevOps, system engineering, and building reliable infrastructure.

<div class="post-list">
{% for post in site.posts %}
  <a class="post-card" href="{{ post.url }}">
    <img class="post-card-image" src="{{ post.image }}" alt="{{ post.title }}">
    <div class="post-card-body">
      <p class="post-card-title">{{ post.title }}</p>
      <p class="post-card-desc">{{ post.description }}</p>
      <p class="post-card-date">{{ post.date | date: "%B %d, %Y" }}</p>
    </div>
  </a>
{% endfor %}
</div>
