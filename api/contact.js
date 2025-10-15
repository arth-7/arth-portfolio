// Lightweight client helper for the contact form (kept for path compatibility).
// If you later add a backend, post to it from here.

export function sendContact({ name, email, message }) {
  // Example: hook up a backend endpoint here.
  // return fetch('/api/echo.js', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, message }) });

  // For now, we just return a resolved Promise to keep callers happy.
  return Promise.resolve({ ok: true, echoed: { name, email, message } });
}
