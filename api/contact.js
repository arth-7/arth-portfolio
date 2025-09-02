// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // --- sanity checks + logging (TEMP while debugging) ---
  const haveKey = Boolean(process.env.RESEND_API_KEY);
  const to = process.env.CONTACT_TO || 'rarth73@gmail.com';
  const from = process.env.CONTACT_FROM || 'Arth Raval <onboarding@resend.dev>';

  if (!haveKey) {
    return res.status(500).json({ ok:false, error:'RESEND_API_KEY is not set in Vercel env vars' });
  }

  const contentType = req.headers['content-type'] || '';
  let data = req.body;
  if (contentType.includes('application/json') && typeof req.body === 'string') {
    try { data = JSON.parse(req.body); } catch {}
  }

  const {
    name = '',
    email = '',
    subject = '',
    message = '',
    _gotcha = '',
    _user_agent = '',
    _referrer = ''
  } = data || {};

  if (_gotcha) return res.status(200).json({ ok: true }); // honeypot
  if (!name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ ok:false, error:'Missing fields (name, email, message)' });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ ok:false, error:'Invalid sender email' });

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

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: subject ? `[Portfolio] ${subject}` : '[Portfolio] New message',
        html,
        reply_to: email
      }),
    });

    if (!r.ok) {
      const txt = await r.text(); // ← show exact reason from Resend
      return res.status(500).json({ ok:false, error:'Email send failed', detail: txt });
    }

    return res.status(200).json({ ok:true });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'Server error', detail: String(e) });
  }
}

// helpers
function esc(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}
