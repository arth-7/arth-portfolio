// Simple dev endpoint (works on serverless hosts like Vercel/Netlify).
// If you're serving static only, this file is harmless to keep in repo.

export default function handler(req, res) {
  const method = req.method || 'GET';
  if (method !== 'POST') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, message: 'Send a POST with JSON to echo' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk });
  req.on('end', () => {
    try {
      const json = JSON.parse(body || '{}');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, received: json, at: new Date().toISOString() }));
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  });
}
