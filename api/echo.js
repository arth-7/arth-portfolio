// /pages/api/echo.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // --- tiny IP rate-limit (good enough for a portfolio) ---
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
         || req.socket?.remoteAddress
         || 'unknown';
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return respond(res, { ok: false, error: 'Too many requests' }, 429);
  }

  try {
    // Accept JSON or x-www-form-urlencoded
    const ct = req.headers['content-type'] || '';
    let data = req.body;

    if (typeof data === 'string' && ct.includes('application/json')) {
      try { data = JSON.parse(data); } catch { data = {}; }
    }
    // If urlencoded, Next/Vercel already parsed into req.body (object)

    const {
      name = '',
      email = '',
      subject = '',
      message = '',
      _gotcha = '',            // honeypot (should be empty)
      _user_agent = '',
      _referrer = '',
    } = data || {};

    // Honeypot → pretend success to drop bots quietly
    if (_gotcha) return respond(res, { ok: true });

    // Validate
    if (!name.trim() || !email.trim() || !message.trim()) {
      return respond(res, { ok: false, error: 'Missing fields' }, 400);
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return respond(res, { ok: false, error: 'Invalid email' }, 400);

    // Compose email (escape to avoid HTML injection)
    const html = `
      <h2>New message from your portfolio</h2>
      <p><b>Name:</b> ${esc(name)}</p>
      <p><b>Email:</b> ${esc(email)}</p>
      ${subject ? `<p><b>Subject:</b> ${esc(subject)}</p>` : ''}
      <p><b>Message:</b><br>${esc(message).replace(/\n/g,'<br>')}</p>
      <hr>
      <p><b>User-Agent:</b> ${esc(_user_agent || '')}</p>
      <p><b>Referrer:</b> ${esc(_referrer || '')}</p>
    `;

    // Send via Resend
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'Arth Raval <onboarding@resend.dev>', // works without domain verification
        to: process.env.CONTACT_TO || 'rarth73@gmail.com',
        subject: subject ? `[Portfolio] ${subject}` : '[Portfolio] New message',
        html,
        reply_to: email
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('Resend error:', r.status, detail);
      return respond(res, { ok: false, error: 'Email send failed', detail }, 500);
    }

    return respond(res, { ok: true });
  } catch (e) {
    console.error(e);
    return respond(res, { ok: false, error: 'Server error' }, 500);
  }
}

/* ---------- helpers ---------- */
function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

const hits = new Map(); // naive in-memory limiter
function rateLimit(ip, { windowMs, max }) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, ts: now };
  if (now - rec.ts > windowMs) { rec.count = 0; rec.ts = now; }
  rec.count += 1; hits.set(ip, rec);
  return rec.count > max;
}

/** JSON if request accepts JSON; otherwise redirect (no-JS fallback) */
function respond(res, payload, code = 200) {
  const wantsJson =
    (res.req.headers.accept || '').includes('application/json') ||
    (res.req.headers['content-type'] || '').includes('application/json');

  if (wantsJson) return res.status(code).json(payload);
  const loc = payload.ok ? '/?sent=1' : '/?error=1';
  return res.writeHead(payload.ok ? 303 : 302, { Location: loc }).end();
}
