// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // --- Tiny rate-limit (best-effort, fine for a small portfolio) ---
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
         || req.socket?.remoteAddress
         || 'unknown';
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return res.status(429).json({ ok: false, error: 'Too many requests' });
  }

  try {
    // Accept JSON (from your JS) and also urlencoded fallback (no-JS submission)
    const ct = req.headers['content-type'] || '';
    let data = req.body;

    if (typeof data === 'string' && ct.includes('application/json')) {
      data = JSON.parse(data);
    }
    // If urlencoded, Vercel already parses into req.body (object)

    const {
      name = '',
      email = '',
      subject = '',
      message = '',
      _gotcha = '',
      _user_agent = '',
      _referrer = '',
    } = data || {};

    // Honeypot
    if (_gotcha) {
      // Act like success to hide behavior from bots
      return respond(res, { ok: true });
    }

    // Validate
    if (!name.trim() || !email.trim() || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return res.status(400).json({ ok: false, error: 'Invalid email' });

    // Compose HTML safely
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
        from: process.env.CONTACT_FROM || 'Arth Raval <onboarding@resend.dev>',
        to: process.env.CONTACT_TO || 'rarth73@gmail.com',
        subject: subject ? `[Portfolio] ${subject}` : '[Portfolio] New message',
        html,
        reply_to: email
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend error:', detail);
      return res.status(500).json({ ok: false, error: 'Email send failed', detail });
    }

    return respond(res, { ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

/** Helpers */
function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

// naive in-memory rate limiter
const hits = new Map();
function rateLimit(ip, { windowMs, max }) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, ts: now };
  if (now - rec.ts > windowMs) { rec.count = 0; rec.ts = now; }
  rec.count += 1;
  hits.set(ip, rec);
  return rec.count > max;
}

/**
 * Respond JSON if request accepts JSON; otherwise redirect (no-JS fallback)
 */
function respond(res, payload) {
  const wantsJson =
    (res.req.headers.accept || '').includes('application/json') ||
    (res.req.headers['content-type'] || '').includes('application/json');

  if (wantsJson) return res.status(200).json(payload);
  // Fallback redirect so non-JS form posts don't show raw JSON
  return res.writeHead(303, { Location: '/?sent=1' }).end();
}
