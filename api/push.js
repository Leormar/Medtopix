import { sql } from './_lib/db.js';
import { handler, requireUser } from './_lib/auth.js';
import { sendPush } from './_lib/push.js';

export default handler(async function (req, res) {
  const action = req.query.action;
  if (req.method === 'GET' && action === 'key') return res.json({ key: process.env.VAPID_PUBLIC_KEY || null });

  const u = await requireUser(req, res); if (!u) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const b = req.body || {};

  if (action === 'subscribe') {
    const s = b.subscription || {};
    const keys = s.keys || {};
    if (!/^https:\/\//.test(String(s.endpoint || '')) || !keys.p256dh || !keys.auth) return res.status(400).json({ error: 'Suscripción no válida.' });
    // un dispositivo pertenece a la última cuenta que inició sesión en él
    await sql`
      insert into push_subscriptions (user_id, endpoint, p256dh, auth, ua)
      values (${u.id}, ${s.endpoint}, ${keys.p256dh}, ${keys.auth}, ${String(req.headers['user-agent'] || '').slice(0, 300)})
      on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua`;
    return res.json({ ok: true });
  }
  if (action === 'unsubscribe') {
    await sql`delete from push_subscriptions where endpoint = ${String(b.endpoint || '')} and user_id = ${u.id}`;
    return res.json({ ok: true });
  }
  if (action === 'test') {
    const sent = await sendPush([u.id], { title: 'MedTopix', body: 'Así le llegarán los avisos de sus dosis, también en el reloj.', tag: 'mt-test', url: '/app' });
    return res.json({ ok: true, sent });
  }
  res.status(400).json({ error: 'Acción desconocida.' });
});
