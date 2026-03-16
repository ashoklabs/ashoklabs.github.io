/**
 * Ashoklabs Course Platform — Cloudflare Worker
 *
 * Routes:
 *   POST /create-order    — Creates a Razorpay order (called from the buy button)
 *   POST /webhook         — Receives Razorpay payment.captured webhook
 *   POST /check-access    — External Evaluation endpoint for Cloudflare Zero Trust Access
 *   GET  /verify-access   — Lets the success page confirm access was granted
 *
 * Environment Variables (set via Cloudflare Dashboard → Workers → Settings → Variables):
 *   RAZORPAY_KEY_ID          — e.g. rzp_live_xxxxxxxxxxxxxx
 *   RAZORPAY_KEY_SECRET      — Razorpay API Key Secret
 *   RAZORPAY_WEBHOOK_SECRET  — From Razorpay Dashboard → Webhooks → Secret
 *
 * KV Namespace Binding (Workers → Settings → Variables → KV Namespace Bindings):
 *   COURSE_ACCESS            — Stores granted access records
 *
 * Secrets (set via: wrangler secret put <NAME>):
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET
 */

const RAZORPAY_API   = 'https://api.razorpay.com/v1';
const SITE_ORIGIN    = 'https://ashoklabs.com';

// ---------------------------------------------------------------------------
// Course catalogue — add new courses here
// ---------------------------------------------------------------------------
const COURSES = {
  'platform-engineering': {
    name:   'AI-Augmented Platform Engineering Bootcamp',
    amount: 100, // paise (₹1)
  },
};

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return preflight();
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'POST' && url.pathname === '/create-order') {
        return await handleCreateOrder(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/webhook') {
        return await handleWebhook(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/check-access') {
        return await handleCheckAccess(request, env);
      }
      if (request.method === 'GET' && url.pathname === '/verify-access') {
        return await handleVerifyAccess(request, env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('Worker error:', err.stack ?? err);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// POST /create-order
// Body: { courseId: string, email: string }
// Returns: { orderId, amount, currency, keyId }
// ---------------------------------------------------------------------------
async function handleCreateOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return cors(json({ error: 'Invalid JSON body' }, 400));
  }

  const { courseId, email } = body ?? {};

  if (!courseId || !email || !email.includes('@')) {
    return cors(json({ error: 'Missing or invalid courseId / email' }, 400));
  }

  const course = COURSES[courseId];
  if (!course) {
    return cors(json({ error: `Unknown courseId: ${courseId}` }, 400));
  }

  const auth = 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);

  const rzpRes = await fetch(`${RAZORPAY_API}/orders`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      amount:   course.amount,
      currency: 'INR',
      receipt:  `rcpt_${courseId}_${Date.now()}`,
      notes:    { courseId, email: email.toLowerCase(), courseName: course.name },
    }),
  });

  if (!rzpRes.ok) {
    const errText = await rzpRes.text();
    console.error('Razorpay order error:', errText);
    return cors(json({ error: 'Payment provider error — please try again' }, 502));
  }

  const order = await rzpRes.json();

  return cors(json({
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    keyId:    env.RAZORPAY_KEY_ID,
  }, 200));
}

// ---------------------------------------------------------------------------
// POST /webhook
// Razorpay sends payment.captured events here.
// Grants KV access keyed by: access:{email}:{courseId}
// ---------------------------------------------------------------------------
async function handleWebhook(request, env) {
  const rawBody  = await request.text();
  const sigHeader = request.headers.get('x-razorpay-signature') ?? '';

  const valid = await verifyHmac(rawBody, sigHeader, env.RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    console.warn('Webhook signature mismatch — rejected');
    return new Response('Unauthorized', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  console.log('Webhook event received:', event.event);

  if (event.event === 'payment.captured') {
    const payment  = event.payload?.payment?.entity ?? {};
    const notes    = payment.notes ?? {};
    const email    = (notes.email ?? payment.email ?? '').toLowerCase();
    const courseId = notes.courseId ?? '';

    if (!email || !courseId) {
      console.warn('Missing email or courseId in payment notes:', JSON.stringify(notes));
      return new Response('Missing metadata', { status: 400 });
    }

    const key   = `access:${email}:${courseId}`;
    const value = JSON.stringify({
      grantedAt: new Date().toISOString(),
      paymentId: payment.id,
      orderId:   payment.order_id,
      amount:    payment.amount,
      email,
      courseId,
    });

    await env.COURSE_ACCESS.put(key, value);
    console.log(`Access granted: ${email} → ${courseId}`);
  }

  return new Response('OK', { status: 200 });
}

// ---------------------------------------------------------------------------
// POST /check-access
// Called by Cloudflare Zero Trust Access "External Evaluation" policy.
// Access sends a signed CF-Access-Jwt-Assertion header containing the user's email.
// We decode (not verify here — CF already verified identity) and check KV.
//
// Response must be: { "success": true } or { "success": false }
// ---------------------------------------------------------------------------
async function handleCheckAccess(request, env) {
  let email;

  // Cloudflare Access sends the user's identity JWT in this header
  const cfJwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (cfJwt) {
    try {
      const [, payloadB64] = cfJwt.split('.');
      // Base64url → standard base64
      const padded  = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(padded));
      email = payload.email;
    } catch (e) {
      console.warn('Failed to decode CF JWT:', e.message);
    }
  }

  // Fallback: plain JSON body (useful for local testing)
  if (!email) {
    try {
      const body = await request.json();
      email = body.email;
    } catch {}
  }

  if (!email) {
    return json({ success: false, reason: 'Could not determine email' }, 200);
  }

  email = email.toLowerCase();

  // Check access for every known course — grant if user has ANY active course
  for (const courseId of Object.keys(COURSES)) {
    const key    = `access:${email}:${courseId}`;
    const record = await env.COURSE_ACCESS.get(key);
    if (record) {
      console.log(`check-access ALLOWED: ${email} → ${courseId}`);
      return json({ success: true }, 200);
    }
  }

  console.log(`check-access DENIED: ${email}`);
  return json({ success: false }, 200);
}

// ---------------------------------------------------------------------------
// GET /verify-access?email=...&courseId=...
// Called client-side from the payment-success page to show a friendly status.
// NOT a security boundary — security is enforced by Cloudflare Access.
// ---------------------------------------------------------------------------
async function handleVerifyAccess(request, env) {
  const url      = new URL(request.url);
  const email    = (url.searchParams.get('email') ?? '').toLowerCase();
  const courseId = url.searchParams.get('courseId') ?? '';

  if (!email || !courseId) {
    return cors(json({ hasAccess: false }, 400));
  }

  const key    = `access:${email}:${courseId}`;
  const record = await env.COURSE_ACCESS.get(key);

  return cors(json({ hasAccess: !!record }, 200));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify Razorpay HMAC-SHA256 webhook signature */
async function verifyHmac(body, signature, secret) {
  if (!signature || !secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBuf   = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/** JSON response */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Wrap a response with CORS headers */
function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin',  SITE_ORIGIN);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}

/** CORS preflight */
function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  SITE_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age':       '86400',
    },
  });
}
