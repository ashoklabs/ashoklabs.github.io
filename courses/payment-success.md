---
layout: default
title: Payment Successful
course_platform: true
---

<div class="payment-success-page">

  <div class="payment-success-icon">✓</div>

  <h1>You're enrolled!</h1>
  <p class="lead">Your payment was successful and your course access is now being activated. This typically takes under 60 seconds.</p>

  <div class="next-steps">
    <h3>What happens next</h3>
    <div class="next-step-item">
      <span class="next-step-num">1</span>
      <div class="next-step-text">
        <strong>Access is activated</strong> — Our system receives your payment confirmation and adds your email to the access list automatically.
      </div>
    </div>
    <div class="next-step-item">
      <span class="next-step-num">2</span>
      <div class="next-step-text">
        <strong>Log in with Google or GitHub</strong> — When you visit the lessons page you will be prompted to log in. Use the <strong>same email address</strong> you entered at checkout.
      </div>
    </div>
    <div class="next-step-item">
      <span class="next-step-num">3</span>
      <div class="next-step-text">
        <strong>Start learning</strong> — Once authenticated, all course lessons unlock immediately. No expiry — you have lifetime access.
      </div>
    </div>
  </div>

  <a href="/courses/platform-engineering/lessons/" class="btn-enroll btn-enroll-lg" id="btn-go-lessons">
    Go to Lessons →
  </a>

  <p style="margin-top:1.25rem;font-size:0.82rem;color:#888;">
    If you have any trouble accessing the course, email
    <a href="mailto:hello@ashoklabs.com" style="color:#157878;">hello@ashoklabs.com</a>
    with your payment receipt.
  </p>

</div>

<script>
// Pre-fill the lessons link with course context if available
(function () {
  const courseId = sessionStorage.getItem('course_id') || 'platform-engineering';
  const email    = sessionStorage.getItem('course_email') || '';
  const btn      = document.getElementById('btn-go-lessons');
  if (btn && courseId) {
    btn.href = '/courses/' + courseId + '/lessons/';
  }
})();
</script>
