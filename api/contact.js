export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const ct = req.headers['content-type'] || '';
  let data = req.body;
  if (typeof data === 'string' && ct.includes('application/json')) {
    try { data = JSON.parse(data); } catch { data = {}; }
  }

  const { name='', email='', subject='', message='', _gotcha='' } = data || {};
  if (_gotcha) return res.status(200).json({ ok:true });
  if (!name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ ok:false, error:'Missing fields' });
  }

  const html = `
    <h2>New Portfolio Message</h2>
    <p><b>Name:</b> ${name}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Subject:</b> ${subject}</p>
    <p><b>Message:</b><br>${message.replace(/\n/g,'<br>')}</p>
  `;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'Arth Raval <onboarding@resend.dev>',
      to: process.env.CONTACT_TO || 'rarth73@gmail.com',
      subject: subject || '[Portfolio] New message',
      html,
      reply_to: email
    })
  });

  if (!r.ok) {
    const detail = await r.text();
    console.error('Resend error:', detail);
    return res.status(500).json({ ok:false, error:'Email send failed', detail });
  }

  return res.status(200).json({ ok:true });
}
