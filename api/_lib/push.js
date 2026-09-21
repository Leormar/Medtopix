import webpush from 'web-push';
import { sql } from './db.js';

let ready = false;
function setup() {
  if (ready) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails('https://medtopix.vercel.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  ready = true;
  return true;
}

// Envía la notificación a todos los dispositivos de esos usuarios. Devuelve cuántas salieron.
// El reloj (Apple Watch, Wear OS) replica las notificaciones del celular: no hay un envío aparte.
export async function sendPush(userIds, payload) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length || !setup()) return 0;
  const subs = await sql`select id, endpoint, p256dh, auth from push_subscriptions where user_id = any(${ids})`;
  let sent = 0;
  await Promise.all(subs.map(async function (s) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      sent++;
      await sql`update push_subscriptions set last_ok_at = now() where id = ${s.id}`;
    } catch (err) {
      // 404/410: el navegador dio de baja la suscripción
      if (err && (err.statusCode === 404 || err.statusCode === 410)) await sql`delete from push_subscriptions where id = ${s.id}`;
      else console.error('push', err && err.statusCode, err && err.body);
    }
  }));
  return sent;
}
