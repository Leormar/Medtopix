import { sql, newLinkCode } from './_lib/db.js';
import { clean } from './_lib/shape.js';
import { handler, hashPassword, verifyPassword, setSession, clearSession, publicUser, requireUser } from './_lib/auth.js';

const ROLES = ['profesional', 'paciente', 'farmaceuta'];

export default handler(async function (req, res) {
  const action = req.query.action;

  if (req.method === 'GET' && action === 'me') {
    const u = await requireUser(req, res); if (!u) return;
    return res.json({ user: publicUser(u) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const b = req.body || {};

  if (action === 'logout') { clearSession(res); return res.json({ ok: true }); }

  if (action === 'login') {
    const email = String(b.email || '').trim().toLowerCase();
    // 8 fallos en 15 minutos bloquean ese correo por el resto de la ventana
    const fails = await sql`select count(*)::int as n from login_attempts where email = ${email} and at > now() - interval '15 minutes'`;
    if (fails[0].n >= 8) return res.status(429).json({ error: 'Demasiados intentos. Espere 15 minutos e intente de nuevo.' });
    const rows = await sql`select * from users where email = ${email}`;
    if (!rows.length || !verifyPassword(String(b.password || ''), rows[0].password_hash)) {
      await sql`insert into login_attempts (email) values (${email.slice(0, 200)})`;
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    await sql`delete from login_attempts where email = ${email} or at < now() - interval '1 day'`;
    setSession(res, rows[0].id);
    return res.json({ user: publicUser(rows[0]) });
  }

  if (action === 'register') {
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const name = clean(b.name, 120) || '';
    const role = String(b.role || '');
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Correo no válido.' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    if (!name) return res.status(400).json({ error: 'Ingresa tu nombre.' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Selecciona un tipo de cuenta.' });
    if (!b.terms) return res.status(400).json({ error: 'Debes aceptar los términos y la política de datos.' });

    const exists = await sql`select 1 from users where email = ${email}`;
    if (exists.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });

    // Un paciente puede vincularse a la ficha que ya le creó su profesional usando el código del caso.
    let claim = null;
    const code = String(b.linkCode || '').trim().toUpperCase();
    if (role === 'paciente' && code) {
      const found = await sql`select id, user_id from patients where link_code = ${code}`;
      if (!found.length) return res.status(400).json({ error: 'Código de caso no encontrado.' });
      if (found[0].user_id) return res.status(409).json({ error: 'Ese caso ya está vinculado a otra cuenta.' });
      claim = found[0].id;
    }

    const rows = await sql`
      insert into users (email, password_hash, name, role, profession, specialty, doc_type, doc_num, phone, terms_accepted_at)
      values (${email}, ${hashPassword(password)}, ${name}, ${role},
              ${role === 'profesional' ? clean(b.profession, 60) : null}, ${clean(b.specialty, 80)},
              ${clean(b.doctype, 10)}, ${clean(b.docnum, 40)}, ${clean(b.phone, 40)}, now())
      returning *`;
    const u = rows[0];

    if (role === 'paciente') {
      if (claim) await sql`update patients set user_id = ${u.id} where id = ${claim}`;
      else await sql`
        insert into patients (user_id, name, id_num, phone, link_code, created_by)
        values (${u.id}, ${name}, ${clean(b.docnum, 40)}, ${clean(b.phone, 40)}, ${newLinkCode()}, ${u.id})`;
    }
    setSession(res, u.id);
    return res.status(201).json({ user: publicUser(u) });
  }

  return res.status(400).json({ error: 'Acción desconocida.' });
});
