---
layout: default
title: Payment Successful
course_platform: true
---

<div class="enroll-success-page">

  <!-- Confetti burst (CSS-only) -->
  <div class="confetti-burst" aria-hidden="true">
    <span></span><span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span><span></span>
  </div>

  <!-- Icon -->
  <div class="enroll-icon-wrap">
    <div class="enroll-icon">
      <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
    </div>
  </div>

  <!-- Heading -->
  <h1 class="enroll-heading">You're enrolled!</h1>
  <p class="enroll-sub" id="enroll-sub">Welcome to the AI-Augmented Platform Engineering Bootcamp. Your lifetime access is being activated now.</p>

  <!-- Access status indicator -->
  <div class="enroll-status-card" id="enroll-status-card">
    <div class="enroll-status-row">
      <div class="enroll-status-spinner" id="enroll-spinner"></div>
      <span class="enroll-status-text" id="enroll-status-text">Activating your access&hellip;</span>
    </div>
    <div class="enroll-status-bar-track">
      <div class="enroll-status-bar-fill" id="enroll-status-bar"></div>
    </div>
  </div>

  <!-- What's included -->
  <div class="enroll-includes">
    <div class="enroll-include-item">
      <div class="enroll-include-icon enroll-include-icon--teal">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
      </div>
      <div>
        <strong>16 Modules</strong>
        <span>Video + written content for each lesson</span>
      </div>
    </div>
    <div class="enroll-include-item">
      <div class="enroll-include-icon enroll-include-icon--green">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
      </div>
      <div>
        <strong>Lifetime Access</strong>
        <span>No expiry — revisit anytime</span>
      </div>
    </div>
    <div class="enroll-include-item">
      <div class="enroll-include-icon enroll-include-icon--purple">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/></svg>
      </div>
      <div>
        <strong>Community Discussion</strong>
        <span>Ask questions on every lesson</span>
      </div>
    </div>
  </div>

  <!-- Next steps -->
  <div class="enroll-steps">
    <div class="enroll-steps-label">What happens next</div>
    <div class="enroll-step">
      <div class="enroll-step-num enroll-step-num--done">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      </div>
      <div class="enroll-step-body">
        <strong>Payment confirmed</strong>
        <span>Your payment was received successfully.</span>
      </div>
    </div>
    <div class="enroll-step">
      <div class="enroll-step-num" id="step-2-num">2</div>
      <div class="enroll-step-body">
        <strong>Access activated</strong>
        <span>Your email is being added to the access list — this takes under 60 seconds.</span>
      </div>
    </div>
    <div class="enroll-step">
      <div class="enroll-step-num">3</div>
      <div class="enroll-step-body">
        <strong>Log in with the same email</strong>
        <span>When you visit the lessons you'll be prompted to sign in via Google or GitHub. Use the <strong>same email</strong> you used at checkout.</span>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <a href="/courses/platform-engineering/lessons/" class="btn-enroll-start" id="btn-go-lessons">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
    Go to My Dashboard
  </a>

  <p class="enroll-help">
    Any trouble? Email <a href="mailto:hello@ashoklabs.com">hello@ashoklabs.com</a> with your payment receipt.
  </p>

</div>

<script>
(function () {
  var courseId = sessionStorage.getItem('course_id') || 'platform-engineering';
  var email    = sessionStorage.getItem('course_email') || '';
  var WORKER_URL = 'https://course-worker.ashoklabs2026.workers.dev';

  // Personalise subtitle
  if (email) {
    var name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    var sub = document.getElementById('enroll-sub');
    if (sub) sub.textContent = 'Welcome, ' + name + '! Your lifetime access to the AI-Augmented Platform Engineering Bootcamp is being activated now.';
  }

  // Update CTA link
  var btn = document.getElementById('btn-go-lessons');
  if (btn && courseId) btn.href = '/courses/' + courseId + '/lessons/';

  // Animated progress bar + polling
  var bar = document.getElementById('enroll-status-bar');
  var statusText = document.getElementById('enroll-status-text');
  var spinner = document.getElementById('enroll-spinner');
  var step2num = document.getElementById('step-2-num');

  var progress = 0;
  var maxBeforeConfirm = 80;
  var interval = setInterval(function() {
    if (progress < maxBeforeConfirm) {
      progress += Math.random() * 6 + 2;
      if (progress > maxBeforeConfirm) progress = maxBeforeConfirm;
      if (bar) bar.style.width = Math.round(progress) + '%';
    }
  }, 600);

  function onAccessConfirmed() {
    clearInterval(interval);
    progress = 100;
    if (bar) bar.style.width = '100%';
    if (bar) bar.classList.add('enroll-status-bar--done');
    if (statusText) statusText.textContent = 'Access activated — you\'re all set!';
    if (spinner) spinner.classList.add('enroll-status-spinner--done');
    if (step2num) {
      step2num.innerHTML = '<svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
      step2num.classList.add('enroll-step-num--done');
    }
  }

  // Poll for access confirmation
  if (email && courseId) {
    var attempts = 0;
    var maxAttempts = 12;
    var pollInterval = setInterval(function() {
      attempts++;
      fetch(WORKER_URL + '/verify-access?email=' + encodeURIComponent(email) + '&courseId=' + encodeURIComponent(courseId))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.hasAccess) {
            clearInterval(pollInterval);
            onAccessConfirmed();
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            if (statusText) statusText.textContent = 'Access is being activated — visit the dashboard in a moment.';
          }
        })
        .catch(function() {
          if (attempts >= maxAttempts) clearInterval(pollInterval);
        });
    }, 3000);
  } else {
    // No email in session — just show as done after a moment
    setTimeout(onAccessConfirmed, 2500);
  }
})();
</script>
