import { sql } from './_lib/db.js';
import { handler, requireUser, newApiKey } from './_lib/auth.js';
import { clean } from './_lib/shape.js';

// Llaves para que una historia clínica electrónica use /api/fhir en nombre de este profesional.
export default handler(async function (req, res) {
  const u = await requireUser(req, res); if (!u) return;
  if (u.role === 'paciente') return res.status(403).json({ error: 'Las llaves de integración son para profesionales y farmaceutas.' });

  let created = null;
  if (req.method === 'POST') {
    const name = clean((req.body || {}).name, 80);
    if (!name) return res.status(400).json({ error: 'Ponle un nombre a la llave (por ejemplo, el sistema que la usará).' });
    const active = await sql`select count(*)::int as n from api_keys where user_id = ${u.id} and revoked_at is null`;
    if (active[0].n >= 5) return res.status(400).json({ error: 'Máximo 5 llaves activas. Revoca una antes de crear otra.' });
    const k = newApiKey();
    await sql`insert into api_keys (user_id, name, prefix, key_hash) values (${u.id}, ${name}, ${k.prefix}, ${k.hash})`;
    created = k.key; // se muestra una sola vez; en la base solo queda el hash
  } else if (req.method === 'DELETE') {
    await sql`update api_keys set revoked_at = now() where id = ${Number(req.query.id)} and user_id = ${u.id} and revoked_at is null`;
  } else if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const keys = await sql`
    select id, name, prefix, created_at, last_used_at from api_keys
    where user_id = ${u.id} and revoked_at is null order by created_at desc`;
  res.status(created ? 201 : 200).json({ keys, created });
});
