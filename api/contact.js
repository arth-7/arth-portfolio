// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Parse JSON or urlencoded
  const ct = req.headers['content-type'] || '';
  let data = req.body;
  if (typeof data === 'string' && ct.includes('application/json')) {
    try { data = JSON.parse(data); } catch { data = {}; }
  }

  const { name = '', email = '', subject = '', message = '', _gotcha = '' } = data || {};
  console.log('CONTACT payload ->', { name, email, subject, len: (message||'').length });

  if (_gotcha) return res.status(200).json({ ok: true }); // honeypot
  if (!name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'Missing fields' });
  }

  const html = `
    <h2>New Portfolio Message</h2>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Email:</b> ${escapeHtml(email)}</p>
    ${subject ? `<p><b>Subject:</b> ${escapeHtml(subject)}</p>` : ''}
    <p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g,'<br>')}</p>
  `;

  // Send via Resend
  try {
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

    const text = await r.text();
    console.log('Resend status:', r.status, 'body:', text);

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: 'Email send failed', detail: text });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Contact send error:', e);
    return res.status(500).json({ ok: false, error: 'Server error', detail: String(e) });
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
}
