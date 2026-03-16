# Ashoklabs Course Platform — Setup Guide

Complete instructions for running a fully serverless, payment-gated online course platform on Jekyll + GitHub Pages + Cloudflare.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         STUDENT JOURNEY                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
            ① visits /courses  │
                               ▼
┌──────────────────────────────────────────────────────┐
│         GitHub Pages (Jekyll static site)            │
│   ashoklabs.com — served via Cloudflare CDN/DNS      │
│                                                      │
│  Public pages:                                       │
│   /courses        (course landing + buy button)      │
│   /courses/payment-success                           │
│                                                      │
│  Protected pages  ◄─── Cloudflare Zero Trust Access ─┤
│   /courses/*/lessons/*                               │
└──────────────────────────────────────────────────────┘
                               │
             ② clicks Buy Now  │
                               ▼
┌──────────────────────────────────────────────────────┐
│          Cloudflare Worker  (course-worker)          │
│   POST /create-order                                 │
│     → calls Razorpay API with amount + email         │
│     → returns { orderId, keyId, amount }             │
└──────────────────────────────────────────────────────┘
                               │
        ③ Razorpay modal opens │
           student pays via UPI│
                               ▼
┌──────────────────────────────────────────────────────┐
│                  Razorpay                            │
│   Processes UPI / Cards / Net Banking payment        │
│   Fires webhook → POST /webhook to Worker            │
└──────────────────────────────────────────────────────┘
                               │
           ④ webhook received  │
                               ▼
┌──────────────────────────────────────────────────────┐
│          Cloudflare Worker  (course-worker)          │
│   POST /webhook                                      │
│     → verify HMAC-SHA256 signature                   │
│     → extract email + courseId from payment.notes    │
│     → KV.put("access:email:courseId", record)        │
└──────────────────────────────────────────────────────┘
                               │
        ⑤ student redirected   │
           to /payment-success │
                               ▼
┌──────────────────────────────────────────────────────┐
│         /courses/platform-engineering/lessons/       │
│   Protected by Cloudflare Zero Trust Access          │
│                                                      │
│   Access Policy: External Evaluation                 │
│     → POST /check-access (Worker)                    │
│     → Worker decodes CF-Access-Jwt-Assertion         │
│     → checks KV for access:email:courseId            │
│     → returns { "success": true/false }              │
└──────────────────────────────────────────────────────┘
                               │
     ⑥ student logs in via     │
        Google or GitHub OAuth  │
                               ▼
┌──────────────────────────────────────────────────────┐
│        Lesson page  (layout: lesson)                 │
│   • Sticky sidebar with lesson navigation            │
│   • YouTube unlisted video (16:9 responsive embed)   │
│   • Written content with code blocks + callouts      │
│   • Prev / Next lesson pager                         │
│   • Giscus discussion (same repo as blog)            │
└──────────────────────────────────────────────────────┘

Technology summary:
  Jekyll           — static site generator
  GitHub Pages     — hosting (free)
  Cloudflare       — DNS, CDN, Zero Trust Access, Workers, KV
  Razorpay         — UPI + Card payment processing
  YouTube Unlisted — video hosting (free)
  Giscus           — GitHub Discussions-backed comments (free)
```

---

## Cost Breakdown

| Service                     | Free tier covers                          | Paid when           |
|-----------------------------|-------------------------------------------|---------------------|
| GitHub Pages                | Unlimited (public repo)                   | Private repo only   |
| Cloudflare CDN + DNS        | Unlimited                                 | Never for basic     |
| Cloudflare Zero Trust Access| 50 users/month free (Teams plan)          | > 50 users          |
| Cloudflare Workers          | 100 000 req/day free                      | > 100k req/day      |
| Cloudflare KV               | 100 000 reads/day free                    | > limits            |
| Razorpay                    | 0 setup fee; 2% per transaction           | Per transaction     |
| YouTube                     | Free for unlisted videos                  | Never               |
| Giscus                      | Free (uses GitHub Discussions API)        | Never               |

**For < 1000 students/month: total infrastructure cost ≈ ₹0/month** (only Razorpay 2% fee per sale).

---

## Prerequisites

- [ ] GitHub account + repository (`ashoklabs/ashoklabs.github.io`)
- [ ] Cloudflare account (free)
- [ ] Domain managed by Cloudflare DNS
- [ ] Razorpay account (KYC verified for live payments)
- [ ] Node.js 18+ and `wrangler` CLI installed
- [ ] YouTube account for video uploads

---

## Step 1 — Set Up Razorpay

### 1.1 Create a Razorpay account

1. Sign up at [razorpay.com](https://razorpay.com)
2. Complete KYC (required for live payments in India)
3. Activate your account

### 1.2 Get API credentials

1. Go to **Settings → API Keys**
2. Generate a key pair
3. Note down:
   - `Key ID` — starts with `rzp_live_` (or `rzp_test_` for testing)
   - `Key Secret` — shown only once; save it securely

### 1.3 Configure the webhook

1. Go to **Settings → Webhooks → Add New Webhook**
2. Set the **Webhook URL** to:
   ```
   https://course-worker.ashoklabs.workers.dev/webhook
   ```
   (or your custom domain once configured)
3. Select events: **payment.captured** only
4. Set a strong **Webhook Secret** — save this value
5. Save the webhook

---

## Step 2 — Deploy the Cloudflare Worker

### 2.1 Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2.2 Create the KV namespace

```bash
cd _cloudflare

# Production namespace
wrangler kv:namespace create "COURSE_ACCESS"
# Note the returned id — copy it

# Preview namespace (for local testing)
wrangler kv:namespace create "COURSE_ACCESS" --preview
```

Edit `_cloudflare/wrangler.toml` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the id returned above.

### 2.3 Set secrets

```bash
# Set each secret interactively (never commit these to Git)
wrangler secret put RAZORPAY_KEY_SECRET
# paste your Razorpay Key Secret when prompted

wrangler secret put RAZORPAY_WEBHOOK_SECRET
# paste your Razorpay Webhook Secret when prompted
```

### 2.4 Update the Key ID

In `_cloudflare/wrangler.toml`, replace the `RAZORPAY_KEY_ID` value:

```toml
[vars]
RAZORPAY_KEY_ID = "rzp_live_YOUR_ACTUAL_KEY_ID"
```

### 2.5 Deploy

```bash
cd _cloudflare
wrangler deploy
```

Expected output:
```
✨  Built successfully
🚀  Deployed course-worker to
    https://course-worker.YOUR_SUBDOMAIN.workers.dev
```

### 2.6 (Optional) Add a custom domain

In Cloudflare Dashboard → Workers → course-worker → Triggers → Custom Domains:

Add: `api.ashoklabs.com`

Then update the `WORKER_URL` in `_includes/razorpay-checkout.html` to `https://api.ashoklabs.com`.

### 2.7 Test the Worker

```bash
# Test order creation
curl -X POST https://course-worker.YOUR_SUBDOMAIN.workers.dev/create-order \
  -H "Content-Type: application/json" \
  -d '{"courseId":"platform-engineering","email":"test@example.com"}'

# Expected: {"orderId":"order_xxx","amount":99900,"currency":"INR","keyId":"rzp_test_xxx"}
```

---

## Step 3 — Configure Cloudflare Zero Trust Access

This protects `/courses/*/lessons/*` so only paying students can view lessons.

### 3.1 Enable Cloudflare Zero Trust

1. In Cloudflare Dashboard, click **Zero Trust** in the left sidebar
2. If first time: choose the **Free** plan (covers 50 users/month)
3. Set your team domain: `ashoklabs.cloudflareaccess.com`

### 3.2 Add Identity Providers

**Google OAuth:**
1. Zero Trust → Settings → Authentication → Login methods → Add new → Google
2. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Set Authorized redirect URI: `https://ashoklabs.cloudflareaccess.com/cdn-cgi/access/callback`
5. Paste Client ID and Client Secret into Cloudflare

**GitHub OAuth:**
1. Zero Trust → Settings → Authentication → Add new → GitHub
2. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
3. Set Callback URL: `https://ashoklabs.cloudflareaccess.com/cdn-cgi/access/callback`
4. Paste Client ID and Client Secret into Cloudflare

### 3.3 Create the Access Application

1. Zero Trust → Access → Applications → Add an Application
2. Choose **Self-hosted**
3. Set:
   - **Application name**: `Platform Engineering Course`
   - **Session Duration**: `1 month`
   - **Application domain**: `ashoklabs.com`
   - **Path**: `courses/platform-engineering/lessons`

   (Repeat for each course path.)

4. Click **Next** → Create a policy:
   - **Policy name**: `Paid Students Only`
   - **Action**: Allow
   - **Include rules**:
     - Rule type: **External Evaluation**
     - URL: `https://course-worker.YOUR_SUBDOMAIN.workers.dev/check-access`
     - Service Token: (leave empty — Worker validates the CF JWT)

5. Click **Next** → **Add application**

> The External Evaluation policy calls your Worker's `/check-access` endpoint for every login attempt. The Worker decodes the Cloudflare-signed JWT, extracts the email, and checks Cloudflare KV. Access is granted only if the record exists.

### 3.4 Test the Access Flow

1. Open a private browser window
2. Navigate to `https://ashoklabs.com/courses/platform-engineering/lessons/`
3. You should see a Cloudflare Access login page
4. Log in with a Google/GitHub account that has **not** purchased
5. You should see "You don't have access"
6. Buy the course, then try again — you should land on the lessons page

---

## Step 4 — Set Up Jekyll Site

### 4.1 Update your Worker URL

In `_includes/razorpay-checkout.html`, update line:

```javascript
const WORKER_URL = 'https://course-worker.ashoklabs.workers.dev';
```

Replace with your Worker URL (or custom domain if set up).

### 4.2 Verify the _config.yml

The site config is already correct for Jekyll + GitHub Pages. No changes needed unless you add a new course.

### 4.3 Adding a new course

To add a second course (e.g., "Kubernetes Deep Dive"):

1. Create `courses/kubernetes-deep-dive.md` with front matter:
   ```yaml
   ---
   layout: course
   title: Kubernetes Deep Dive
   course_id: kubernetes-deep-dive
   price: 1499
   duration: 8 Weeks
   level: Advanced
   format: Online · Self-paced
   ---
   ```

2. Create `courses/kubernetes-deep-dive/lessons/` directory with lesson files

3. Add the course to `COURSES` in `_cloudflare/worker.js`:
   ```javascript
   const COURSES = {
     'platform-engineering': { name: '...', amount: 99900 },
     'kubernetes-deep-dive':  { name: 'Kubernetes Deep Dive', amount: 149900 },
   };
   ```

4. Create a new Cloudflare Access Application for path `courses/kubernetes-deep-dive/lessons`

5. Redeploy the Worker: `wrangler deploy`

### 4.4 Build and deploy

```bash
# Test locally
bundle exec jekyll serve

# GitHub Actions handles deployment automatically on push to main
git add .
git commit -m "feat: add course platform"
git push origin main
```

---

## Step 5 — Upload Videos to YouTube

### 5.1 Upload as Unlisted

For each lesson video:

1. Go to [YouTube Studio](https://studio.youtube.com)
2. Upload your video
3. Set visibility to **Unlisted** (not Public, not Private)
4. Copy the video ID from the URL: `youtube.com/watch?v=VIDEO_ID_HERE`

### 5.2 Add the video ID to the lesson

In each lesson's front matter:

```yaml
---
layout: lesson
title: Engineering Foundations
video_id: YOUR_YOUTUBE_VIDEO_ID_HERE
---
```

The lesson layout automatically embeds it in a responsive 16:9 player.

---

## Step 6 — Configure Giscus (Comments)

Your Giscus config is already set up from the existing blog post layout. The lesson layout uses the same configuration. No additional setup is needed.

If you want lesson discussions separated from blog post discussions, create a new GitHub Discussions category called "Course Discussions" and update the `data-category` and `data-category-id` in `_layouts/lesson.html`.

---

## Security Model

### Threat model and mitigations

| Threat                                  | Mitigation                                                    |
|-----------------------------------------|---------------------------------------------------------------|
| Unauthenticated access to lessons       | Cloudflare Access enforces login for all `/courses/*/lessons/*` paths |
| Accessing lessons without paying        | External Evaluation policy checks KV before granting access   |
| Fake webhook to grant free access       | HMAC-SHA256 signature verification on every webhook           |
| Payment replay / duplicate grant        | KV `put` is idempotent — replaying the same payment is safe   |
| API key exposure in client-side JS      | Only `RAZORPAY_KEY_ID` (public) is sent to the browser; secret stays in Worker |
| Video URL sharing                       | YouTube Unlisted — not searchable, but URLs can be shared     |
| KV key enumeration                      | KV keys include email hash; Worker does not expose list endpoint |
| Worker URL enumeration/abuse            | Create order requires valid courseId; rate limiting can be added |

### What Cloudflare Access guarantees

- Every request to `/courses/*/lessons/*` is intercepted at Cloudflare's edge
- The user **must** authenticate with Google or GitHub before any HTML is served
- The External Evaluation call happens **before** any content reaches the browser
- Session cookies are signed by Cloudflare; they cannot be forged

### What this system does NOT prevent

- A paying student sharing their login credentials with others
- A paying student screen-recording videos
- URL guessing for YouTube Unlisted videos (use YouTube Premium/private + signed URLs for higher security)

---

## Optional Improvements

### Preventing video sharing

**Option A: Signed YouTube URLs (serverless)**
Replace YouTube embeds with a Cloudflare Worker that generates short-lived signed tokens and streams video through an authenticated proxy. Complex but fully serverless.

**Option B: Cloudflare Stream**
Upload videos to Cloudflare Stream instead of YouTube. Stream supports:
- Signed URLs that expire after N minutes
- Domain-locked embeds (only plays on your domain)
- Native HLS — no direct URL to copy

Cost: ~$5/1000 minutes of video stored/month.

**Option C: Mux**
Professional video hosting with signed playback tokens. Starts at $20/month.

### Scaling to thousands of students

| Scale          | Concern                          | Solution                              |
|----------------|----------------------------------|---------------------------------------|
| > 50 users/mo  | Cloudflare Access free limit      | Upgrade to Teams ($7/user/mo)        |
| > 100k req/day | Worker free limit                 | Workers Paid ($5/month flat)         |
| > 1M KV reads  | KV read limit                     | KV Paid (included in Workers Paid)   |
| Many courses   | Access application per course    | Use path wildcards, one application  |

### Email receipts on purchase

Add to the Worker's `handleWebhook` function after writing to KV:

```javascript
// Using Cloudflare Email Workers or Resend API
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from:    'noreply@ashoklabs.com',
    to:      email,
    subject: `You're enrolled: ${course.name}`,
    html:    `<p>Thank you! Your access is now active.</p>
              <p><a href="https://ashoklabs.com/courses/${courseId}/lessons/">Start Learning →</a></p>`,
  }),
});
```

### Discount codes / coupons

Add a `coupon` parameter to `/create-order`. The Worker validates the coupon code (stored in a KV namespace) and adjusts the order amount before calling Razorpay.

### Student dashboard

Create a `/courses/my-courses/` page that:
1. Reads `sessionStorage` for the email (set after payment)
2. Calls a Worker endpoint `/my-courses?email=...`
3. Worker returns which courses the email has access to
4. Page displays enrolled courses with direct lesson links

---

## File Reference

```
/
├── _cloudflare/
│   ├── worker.js                         ← Cloudflare Worker source
│   └── wrangler.toml                     ← Worker deployment config
│
├── _layouts/
│   ├── default.html                      ← Base layout (nav + footer)
│   ├── course.html                       ← Course landing (+ buy card)
│   ├── lesson.html                       ← Protected lesson (sidebar + video + giscus)
│   └── post.html                         ← Blog post layout
│
├── _includes/
│   └── razorpay-checkout.html            ← Buy card + Razorpay JS
│
├── assets/css/
│   ├── custom.css                        ← Site-wide brand styles
│   └── course-platform.css              ← Lesson/course-specific styles
│
├── courses/
│   ├── courses.md                        ← Course landing page (public)
│   ├── payment-success.md               ← Post-payment page (public)
│   └── platform-engineering/
│       └── lessons/
│           ├── index.md                 ← Lesson list (protected by CF Access)
│           ├── 01-engineering-foundations.md
│           ├── 02-application-platform.md
│           └── ... (16 lessons total)
│
└── COURSE_PLATFORM_README.md            ← This file
```

---

## Troubleshooting

### "Access denied" after payment

1. Check the Cloudflare Worker logs:
   ```bash
   wrangler tail
   ```
2. Look for `"Access granted: email → courseId"` in the logs
3. If missing, the webhook did not arrive — check Razorpay Dashboard → Webhooks → Logs
4. Verify the webhook signature secret matches `RAZORPAY_WEBHOOK_SECRET` in the Worker

### Student sees login page even after paying

1. Confirm the email they used at checkout matches the email on their Google/GitHub account
2. Check KV directly:
   ```bash
   wrangler kv:key get --binding COURSE_ACCESS "access:user@example.com:platform-engineering"
   ```
3. If key exists, the issue is with the External Evaluation policy URL — confirm it points to your deployed Worker

### Razorpay order creation fails

1. Ensure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are correctly set
2. For live payments, ensure your Razorpay account is KYC-verified and activated
3. Check the Worker logs for the raw Razorpay error response

### Jekyll build fails locally

```bash
bundle install
bundle exec jekyll serve --livereload
```

Ensure you have Ruby 3.x and Bundler installed.

---

## Quick Start Checklist

- [ ] Deploy Worker (`wrangler deploy`)
- [ ] Set Worker secrets (Key Secret + Webhook Secret)
- [ ] Create KV namespace and update `wrangler.toml`
- [ ] Configure Razorpay webhook URL to point to Worker
- [ ] Set up Cloudflare Zero Trust (Google + GitHub identity providers)
- [ ] Create Access Application for `/courses/*/lessons/*`
- [ ] Add External Evaluation policy pointing to `/check-access`
- [ ] Update `WORKER_URL` in `_includes/razorpay-checkout.html`
- [ ] Upload lesson videos to YouTube as Unlisted
- [ ] Add `video_id` to each lesson's front matter
- [ ] Push to GitHub → verify GitHub Pages deployment
- [ ] Do a full end-to-end test purchase with `rzp_test_` keys
- [ ] Switch to live Razorpay keys
- [ ] Announce the course
