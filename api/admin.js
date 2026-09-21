import { sql } from './_lib/db.js';
import { handler, requireUser, isAdmin } from './_lib/auth.js';
import { sendPush } from './_lib/push.js';

// Verificación de cuentas de profesionales y farmaceutas. Solo para administradores (ADMIN_EMAILS).
export default handler(async function (req, res) {
  const u = await requireUser(req, res); if (!u) return;
  if (!isAdmin(u)) return res.status(404).json({ error: 'No encontrado.' });

  if (req.method === 'POST') {
    const b = req.body || {};
    const id = Number(b.id);
    const target = (await sql`select id, role from users where id = ${id}`)[0];
    if (!target || target.role === 'paciente') return res.status(404).json({ error: 'Cuenta no encontrada.' });
    if (b.action === 'approve') {
      await sql`update users set verified_at = now(), verified_by = ${u.id} where id = ${id}`;
      await sendPush([id], { title: 'MedTopix · cuenta verificada', body: 'Su cuenta fue verificada. Ya puede seguir casos.', tag: 'mt-verified', url: '/app' });
    } else if (b.action === 'revoke') {
      await sql`update users set verified_at = null, verified_by = ${u.id} where id = ${id}`;
    } else return res.status(400).json({ error: 'Acción desconocida.' });
  } else if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const rows = await sql`
    select id, name, email, role, profession, doc_type, doc_num, created_at, verified_at,
           (google_sub is not null) as google, (apple_sub is not null) as apple
    from users where role <> 'paciente'
    order by (verified_at is null) desc, created_at desc limit 300`;
  res.json({ accounts: rows, pending: rows.filter(function (r) { return !r.verified_at; }).length });
});
