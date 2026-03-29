---
layout: default
title: Newsletter
description: Weekly insights on DevOps, platform engineering, and building reliable infrastructure — straight to your inbox.
---

<div class="newsletter-page">

  <div class="newsletter-hero">
    <p class="newsletter-label">Free Weekly Newsletter</p>
    <h1 class="newsletter-heading">Platform Engineering<br>in Your Inbox</h1>
    <p class="newsletter-sub">Practical DevOps, Kubernetes, CI/CD, and AI-assisted platform engineering — no fluff, written by a practitioner.</p>
  </div>

  <div class="newsletter-card">
    <div class="newsletter-perks">
      <div class="perk">
        <span class="perk-icon">⚙️</span>
        <div>
          <strong>Hands-on guides</strong>
          <p>Real workflows you can apply immediately — Terraform, Kubernetes, GitHub Actions.</p>
        </div>
      </div>
      <div class="perk">
        <span class="perk-icon">🤖</span>
        <div>
          <strong>AI in platform engineering</strong>
          <p>How to use AI tools to debug, generate IaC, and accelerate operations.</p>
        </div>
      </div>
      <div class="perk">
        <span class="perk-icon">📬</span>
        <div>
          <strong>Weekly. Free.</strong>
          <p>One focused issue per week. Unsubscribe any time.</p>
        </div>
      </div>
    </div>

    <form class="newsletter-form" id="newsletter-form" action="https://newsletter.ashoklabs.com/create" method="POST" accept-charset="utf-8">
      <input type="hidden" name="subscribe_error_message" value="Oops, something went wrong.">
      <input type="hidden" name="subscribe_success_message" value="Subscribed!">
      <input type="hidden" name="ref" value="">
      <input type="hidden" name="bhba" value="">
      <input type="hidden" name="premium_offer_id" value="">
      <input type="hidden" name="fallback_path" value="/">
      <input type="hidden" name="is_js_enabled" value="true">
      <input type="hidden" name="sent_from_orchid" value="true">
      <input type="hidden" name="signup_flow_id" value="">
      <input type="hidden" name="automation_ids" value="">
      <input type="hidden" name="double_opt" value="false">

      <div class="newsletter-input-row">
        <input
          type="email"
          name="email"
          placeholder="your@email.com"
          required
          class="newsletter-email-input"
          aria-label="Email address"
        >
        <button type="submit" class="newsletter-submit">Subscribe Free</button>
      </div>
      <p class="newsletter-privacy">No spam. Unsubscribe anytime.</p>
    </form>
  </div>

  {% if site.data.issues.size > 0 %}
  <div class="newsletter-issues">
    <h2>Past Issues</h2>
    <ul class="issues-list">
      {% for issue in site.data.issues %}
      <li>
        <span class="issue-date">{{ issue.date }}</span>
        <a class="issue-link" href="{{ issue.url }}" target="_blank" rel="noopener">{{ issue.title }}</a>
      </li>
      {% endfor %}
    </ul>
  </div>
  {% endif %}

</div>

<!-- Success popup -->
<div class="nl-popup-overlay" id="nl-popup" role="dialog" aria-modal="true" aria-label="Subscription confirmed">
  <div class="nl-popup-card">
    <div class="nl-check">
      <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle class="nl-check-circle" cx="26" cy="26" r="24" stroke="#22c55e" stroke-width="3" fill="none"/>
        <path class="nl-check-tick" d="M14 26l9 9 15-15" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h3>You're subscribed!</h3>
    <p>Check your inbox for a confirmation email.</p>
    <button class="nl-popup-close" id="nl-popup-close">Done</button>
  </div>
</div>

<script>
document.getElementById('newsletter-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var form = this;
  var data = new FormData(form);
  fetch(form.action, {
    method: 'POST',
    body: new URLSearchParams(data),
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).catch(function() {});
  document.getElementById('nl-popup').classList.add('nl-popup--visible');
  form.reset();
});
document.getElementById('nl-popup-close').addEventListener('click', function() {
  document.getElementById('nl-popup').classList.remove('nl-popup--visible');
});
document.getElementById('nl-popup').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('nl-popup--visible');
});
</script>
