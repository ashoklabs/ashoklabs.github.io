---
layout: default
title: Search
description: Search all posts on Ashoklabs.
sitemap: false
---

<div class="search-page">
  <div class="home-intro">
    <p class="home-intro__label">Search</p>
  </div>
  <div class="search-input-wrap">
    <svg class="search-input-icon" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
    <input type="search" id="search-input" class="search-input" placeholder="Search posts…" aria-label="Search posts" autofocus>
  </div>
  <p id="search-empty" class="search-empty" style="display:none">No posts found.</p>
  <div id="search-results" class="post-list" aria-live="polite"></div>
</div>

<script src="https://unpkg.com/lunr/lunr.js"></script>
<script>
(function () {
  var idx, posts;
  fetch('/search.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      posts = data;
      idx = lunr(function () {
        this.ref('id');
        this.field('title',       { boost: 10 });
        this.field('categories',  { boost: 5  });
        this.field('description', { boost: 3  });
        this.field('content');
        data.forEach(function (p) { this.add(p); }, this);
      });
      var q = new URLSearchParams(window.location.search).get('q');
      if (q) { document.getElementById('search-input').value = q; runSearch(q); }
    });

  document.getElementById('search-input').addEventListener('input', function () {
    runSearch(this.value.trim());
  });

  function runSearch(query) {
    var resultsEl = document.getElementById('search-results');
    var emptyEl   = document.getElementById('search-empty');
    resultsEl.innerHTML = '';
    if (!query || !idx) { emptyEl.style.display = 'none'; return; }
    var results = idx.search(query + '*');
    if (!results.length) { emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';
    results.forEach(function (r) {
      var post = posts.find(function (p) { return String(p.id) === String(r.ref); });
      if (!post) return;
      var a = document.createElement('a');
      a.className = 'post-card';
      a.href = post.url;
      a.innerHTML =
        '<div class="post-card-image post-card-placeholder"></div>' +
        '<div class="post-card-body">' +
          '<p class="post-card-title">' + esc(post.title) + '</p>' +
          '<p class="post-card-desc">'  + esc(post.description) + '</p>' +
          '<div class="post-card-foot">' +
            (post.categories ? '<span class="post-card-cat">' + esc(post.categories) + '</span>' : '') +
            '<span class="post-card-date">' + esc(post.date) + '</span>' +
          '</div>' +
        '</div>';
      resultsEl.appendChild(a);
    });
  }

  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
</script>
