// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // --- tiny IP rate-limit (optional) ---
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const limited = rateLimit(ip, { windowMs: 60_000, max: 10 }); // 10/min
  if (limited) return res.status(429).json({ ok: false, error: 'Too many requests' });

  try {
    const contentType = req.headers['content-type'] || '';
    let data = req.body;
    if (contentType.includes('application/json') && typeof req.body === 'string') {
      data = JSON.parse(req.body);
    }

    const {
      name = '',
      email = '',
      subject = '',
      message = '',
      _gotcha = '',
      _user_agent = '',
      _referrer = '',
    } = data || {};

    if (_gotcha) return res.status(200).json({ ok: true }); // bot trap
    if (!name.trim() || !email.trim() || !message.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return res.status(400).json({ ok: false, error: 'Invalid email' });

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
        // While you set up your own domain, you can use this onboard sender:
        // 'onboarding@resend.dev'. Later switch to CONTACT_FROM (verified domain).
        from: process.env.CONTACT_FROM || 'onboarding@resend.dev',
        to: process.env.CONTACT_TO || 'rarth73@gmail.com',
        subject: subject ? `[Portfolio] ${subject}` : '[Portfolio] New message',
        html,
        reply_to: email
      }),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('Resend error:', txt);
      return res.status(500).json({ ok: false, error: 'Email send failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// helpers
function esc(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;"); }

// naive in-memory limiter (sufficient for a small portfolio)
const hits = new Map();
function rateLimit(ip, { windowMs, max }) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, ts: now };
  if (now - rec.ts > windowMs) { rec.count = 0; rec.ts = now; }
  rec.count += 1; hits.set(ip, rec);
  return rec.count > max;
}
