import { sql } from './_lib/db.js';
import { handler, requireActive } from './_lib/auth.js';

// Bandeja de alertas del equipo tratante: dosis sin cumplir de los casos que sigue.
export default handler(async function (req, res) {
  const u = await requireActive(req, res); if (!u) return;

  if (req.method === 'POST') {
    const id = Number((req.body || {}).id);
    if (id) await sql`update alerts set read_at = now() where id = ${id} and user_id = ${u.id} and read_at is null`;
    else await sql`update alerts set read_at = now() where user_id = ${u.id} and read_at is null`;
  } else if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const rows = await sql`
    select a.id, a.patient_id, a.treatment_id, a.kind, a.message, a.created_at, a.read_at
    from alerts a where a.user_id = ${u.id} and (a.read_at is null or a.created_at > now() - interval '14 days')
    order by a.created_at desc limit 100`;
  res.json({ alerts: rows, unread: rows.filter(function (a) { return !a.read_at; }).length });
});
