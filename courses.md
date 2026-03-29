---
layout: course
title: AI-Augmented Platform Engineering Bootcamp
description: Design, build, and operate production-grade platforms using cloud-native technologies and AI-assisted workflows.
duration: 16 Weeks
level: Intermediate – Advanced
format: Online · Self-paced
course_id: platform-engineering
price: 5000
original_price: 10000
course_platform: true
---

<div class="course-waitlist">
  <p class="course-waitlist__badge">Coming Soon — Early Access</p>
  <h2 class="course-waitlist__heading">Join the waitlist &amp; save 50%</h2>
  <p class="course-waitlist__sub">Get notified the moment the course launches and lock in the early-access price of <strong>₹5,000</strong> (regular ₹10,000). <span class="course-waitlist__count">150+ engineers already on the list.</span></p>
  <form class="course-waitlist__form" id="waitlist-form" action="https://newsletter.ashoklabs.com/create" method="POST" accept-charset="utf-8">
    <input type="hidden" name="is_js_enabled" value="true">
    <input type="hidden" name="sent_from_orchid" value="true">
    <input type="hidden" name="double_opt" value="false">
    <input type="hidden" name="fallback_path" value="/">
    <input type="hidden" name="ref" value="course-waitlist">
    <div class="course-waitlist__row">
      <input type="email" name="email" placeholder="your@email.com" required aria-label="Email address" class="course-waitlist__input">
      <button type="submit" class="course-waitlist__btn">Join Waitlist</button>
    </div>
    <p class="course-waitlist__note">No spam. Unsubscribe anytime.</p>
  </form>
  <p class="course-waitlist__thanks" id="waitlist-thanks" style="display:none">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style="vertical-align:-3px;margin-right:5px"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
    You're on the list! We'll email you when the course launches.
  </p>
  <script>
  document.getElementById('waitlist-form').addEventListener('submit', function(e) {
    e.preventDefault();
    fetch(this.action, { method: 'POST', body: new URLSearchParams(new FormData(this)), mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(function(){});
    this.style.display = 'none';
    document.getElementById('waitlist-thanks').style.display = 'block';
  });
  </script>
</div>

<section class="course-section">
<h2>Overview</h2>
<p>This programme teaches how modern engineering teams design, build, and operate production-grade platforms using cloud-native technologies. You will work on real infrastructure problems — not toy examples — and graduate with a complete internal developer platform you built yourself.</p>

<div class="course-pillars">
  <div class="pillar">
    <div class="pillar-icon">⚙️</div>
    <h4>Infrastructure as Code</h4>
    <p>Terraform, GitOps, and environment automation at scale.</p>
  </div>
  <div class="pillar">
    <div class="pillar-icon">☸️</div>
    <h4>Kubernetes Platform</h4>
    <p>From fundamentals to advanced operator patterns and service mesh.</p>
  </div>
  <div class="pillar">
    <div class="pillar-icon">📊</div>
    <h4>Observability &amp; Reliability</h4>
    <p>Metrics, logs, traces, SLOs, and production incident response.</p>
  </div>
  <div class="pillar">
    <div class="pillar-icon">🤖</div>
    <h4>AI-Assisted Operations</h4>
    <p>Use AI to debug, generate infrastructure, and summarise incidents.</p>
  </div>
</div>
</section>

<section class="course-section">
<h2>What You Will Learn</h2>

- Design scalable platform architectures for real organisations
- Build CI/CD and GitOps deployment pipelines from scratch
- Operate Kubernetes platforms in production with confidence
- Implement full-stack observability and reliability engineering
- Build internal developer platforms that give teams self-service infrastructure
- Debug production incidents using structured runbooks and tooling
- Optimise infrastructure cost with FinOps practices
- Implement platform governance, security scanning, and compliance controls
- Use AI tools to accelerate every part of the platform engineering workflow
</section>

<section class="course-section">
<h2>Curriculum</h2>
<div class="curriculum-grid">
  <div class="curriculum-item">
    <span class="week-badge">Week 1</span>
    <div class="curriculum-info">
      <strong>Engineering Foundations</strong>
      <span>Linux, networking, DNS, HTTP, Git workflows</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 2</span>
    <div class="curriculum-info">
      <strong>Application Platform</strong>
      <span>Microservices, API and worker services, databases</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 3</span>
    <div class="curriculum-info">
      <strong>Containerisation</strong>
      <span>Docker, image optimisation, multi-stage builds</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 4</span>
    <div class="curriculum-info">
      <strong>CI/CD Engineering</strong>
      <span>GitHub Actions, automated testing, artifact management</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 5</span>
    <div class="curriculum-info">
      <strong>Infrastructure as Code</strong>
      <span>Terraform, modules, remote state, drift detection</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 6</span>
    <div class="curriculum-info">
      <strong>Kubernetes Fundamentals</strong>
      <span>Pods, Deployments, Services, Ingress, autoscaling</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 7</span>
    <div class="curriculum-info">
      <strong>Kubernetes Advanced Platform</strong>
      <span>Helm, KEDA, Knative, custom operators</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 8</span>
    <div class="curriculum-info">
      <strong>GitOps Platform</strong>
      <span>Argo CD, deployment automation, reconciliation</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 9</span>
    <div class="curriculum-info">
      <strong>Platform Networking &amp; Service Mesh</strong>
      <span>Istio, mTLS, traffic routing, service discovery</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 10</span>
    <div class="curriculum-info">
      <strong>Observability Platform</strong>
      <span>Prometheus, Grafana, OpenTelemetry, SLO/SLI design</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 11</span>
    <div class="curriculum-info">
      <strong>Production Operations</strong>
      <span>Incident response, RCA, postmortems, production debugging</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 12</span>
    <div class="curriculum-info">
      <strong>Internal Developer Platforms</strong>
      <span>Backstage, golden paths, self-service infrastructure</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 13</span>
    <div class="curriculum-info">
      <strong>Security &amp; Compliance</strong>
      <span>DevSecOps, secrets management, SOC2 basics</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 14</span>
    <div class="curriculum-info">
      <strong>FinOps &amp; Cost Optimisation</strong>
      <span>Cloud cost management, resource optimisation</span>
    </div>
  </div>
  <div class="curriculum-item">
    <span class="week-badge">Week 15</span>
    <div class="curriculum-info">
      <strong>Chaos Engineering</strong>
      <span>Fault injection, resilience testing, failure simulation</span>
    </div>
  </div>
  <div class="curriculum-item curriculum-item--highlight">
    <span class="week-badge week-badge--ai">Week 16</span>
    <div class="curriculum-info">
      <strong>AI-Powered Platform Engineering</strong>
      <span>AI debugging, log analysis, infrastructure generation</span>
    </div>
  </div>
</div>
</section>

<section class="course-section">
<h2>Capstone Project</h2>
<p>Throughout the course you will incrementally build a complete internal developer platform. By the final week you will have delivered:</p>

<div class="capstone-grid">
  <div class="capstone-item">CI Pipeline</div>
  <div class="capstone-item">GitOps Deployment</div>
  <div class="capstone-item">Kubernetes Application Platform</div>
  <div class="capstone-item">Observability Stack</div>
  <div class="capstone-item">Developer Self-Service Portal</div>
  <div class="capstone-item">Platform Governance</div>
  <div class="capstone-item">Cost Monitoring</div>
  <div class="capstone-item">Incident Response Workflows</div>
</div>
</section>

<section class="course-section">
<h2>About the Instructor</h2>
<div class="instructor-card">
  <img class="instructor-card__avatar" src="{{ site.author.avatar }}" alt="{{ site.author.name }}" width="80" height="80" loading="lazy">
  <div class="instructor-card__body">
    <p class="instructor-card__name">{{ site.author.name }}</p>
    <p class="instructor-card__title">{{ site.author.title }}</p>
    <p class="instructor-card__bio">10 years designing and operating production-grade infrastructure at Backbase, Cognizant, HCL Technologies, and Cloud4C. Specialises in Kubernetes platform engineering, Terraform, CI/CD automation, and observability on Azure and AWS.</p>
    <div class="instructor-card__certs">
      <span class="instructor-cert">Azure Certified DevOps Expert</span>
      <span class="instructor-cert">Azure Certified Solution Architect</span>
      <span class="instructor-cert">Azure Certified Administrator</span>
    </div>
    <a href="{{ site.author.url }}" target="_blank" rel="noopener" class="author-card__link" style="margin-top:0.75rem;display:inline-flex">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-1px;margin-right:4px"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
      linkedin.com/in/ashokvalakatla
    </a>
  </div>
</div>
</section>

<section class="course-section course-cta-section">
<h2>Ready to build production platforms?</h2>
<p>One payment — lifetime access. Start immediately after purchase. All 16 weeks of content available right away.</p>
<a href="#buy-card" class="btn-enroll btn-enroll-lg">Enrol Now — ₹5,000 <s style="opacity:0.6;font-size:0.85em;">₹10,000</s></a>
<p style="margin-top:0.75rem;font-size:0.82rem;color:#888;">Secure payment via Razorpay &middot; UPI, Cards, Net Banking accepted</p>
</section>
