---
layout: default
title: Blog
description: Practical guides on DevOps, Terraform, platform engineering, and Kubernetes.
hide_hero: true
---

<div class="home-intro">
  <p class="home-intro__label">All Posts</p>
  <p class="home-intro__text">Practical engineering insights — no fluff, just the stuff that works in production.</p>
</div>

<div class="blog-filters" id="blog-filters" role="group" aria-label="Filter by category">
  <button class="blog-filter-btn active" data-cat="all">All</button>
  {% assign cats = site.posts | map: "categories" | flatten | uniq | sort %}
  {% for cat in cats %}
  <button class="blog-filter-btn" data-cat="{{ cat }}">{{ cat | capitalize }}</button>
  {% endfor %}
</div>

<div class="post-list" id="blog-post-list">
{% for post in site.posts %}
  <a class="post-card" href="{{ post.url | relative_url }}" data-cats="{{ post.categories | join: ' ' }}">
    {% if post.image %}
    <img class="post-card-image" src="{{ post.image }}" alt="{{ post.title }}" loading="lazy">
    {% else %}
    <div class="post-card-image post-card-placeholder"></div>
    {% endif %}
    <div class="post-card-body">
      <p class="post-card-title">{{ post.title }}</p>
      {% if post.description %}<p class="post-card-desc">{{ post.description }}</p>{% endif %}
      <div class="post-card-foot">
        {% if post.categories.size > 0 %}<span class="post-card-cat">{{ post.categories[0] | capitalize }}</span>{% endif %}
        <span class="post-card-date">{{ post.date | date: "%b %d, %Y" }}</span>
        <span class="post-card-read">{{ post.content | number_of_words | divided_by: 200 | plus: 1 }} min read</span>
      </div>
    </div>
  </a>
{% endfor %}
</div>

<script>
(function () {
  var btns  = document.querySelectorAll('.blog-filter-btn');
  var cards = document.querySelectorAll('#blog-post-list .post-card');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = this.getAttribute('data-cat');
      btns.forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      cards.forEach(function (card) {
        var cardCats = card.getAttribute('data-cats') || '';
        card.style.display = (cat === 'all' || cardCats.indexOf(cat) !== -1) ? '' : 'none';
      });
    });
  });
})();
</script>
