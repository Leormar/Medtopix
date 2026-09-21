import { sql, newLinkCode } from './_lib/db.js';
import { clean } from './_lib/shape.js';
import { socialConfig, verifyIdToken, signPending, readPending } from './_lib/social.js';
import { handler, hashPassword, verifyPassword, setSession, clearSession, publicUser, requireUser } from './_lib/auth.js';

const ROLES = ['profesional', 'paciente', 'farmaceuta'];

// Crea la cuenta con su tipo, términos aceptados y, si es paciente, su ficha (nueva o la que ya le creó su profesional).
// Es el mismo camino para quien se registra con correo, con Google o con Apple.
async function createAccount(b, id) {
  const name = clean(b.name, 120) || '';
  const role = String(b.role || '');
  if (!name) return { status: 400, error: 'Ingresa tu nombre.' };
  if (!ROLES.includes(role)) return { status: 400, error: 'Selecciona un tipo de cuenta.' };
  if (!b.terms) return { status: 400, error: 'Debes aceptar los términos y la política de datos.' };

  let claim = null;
  const code = String(b.linkCode || '').trim().toUpperCase();
  if (role === 'paciente' && code) {
    const found = await sql`select id, user_id from patients where link_code = ${code}`;
    if (!found.length) return { status: 400, error: 'Código de caso no encontrado.' };
    if (found[0].user_id) return { status: 409, error: 'Ese caso ya está vinculado a otra cuenta.' };
    claim = found[0].id;
  }
  const rows = await sql`
    insert into users (email, password_hash, google_sub, apple_sub, name, role, profession, specialty, doc_type, doc_num, phone, terms_accepted_at)
    values (${id.email}, ${id.passwordHash}, ${id.google_sub || null}, ${id.apple_sub || null}, ${name}, ${role},
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
  return { user: u };
}

export default handler(async function (req, res) {
  const action = req.query.action;

  // qué botones de ingreso mostrar: los identificadores de cliente son públicos por diseño
  if (req.method === 'GET' && action === 'config') return res.json(socialConfig());

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
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Correo no válido.' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
    const exists = await sql`select 1 from users where email = ${email}`;
    if (exists.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
    const out = await createAccount(b, { email, passwordHash: hashPassword(password) });
    if (out.error) return res.status(out.status).json({ error: out.error });
    setSession(res, out.user.id);
    return res.status(201).json({ user: publicUser(out.user) });
  }

  // Ingreso con Google o Apple. Primer paso: el token del proveedor. Si la persona es nueva, vuelve con el
  // pase `pending` después de elegir tipo de cuenta y aceptar los términos.
  if (action === 'google' || action === 'apple') {
    let who = b.pending ? readPending(b.pending) : null;
    if (b.pending && (!who || who.provider !== action)) return res.status(401).json({ error: 'La verificación venció. Vuelva a pulsar el botón de ingreso.' });
    if (!who) {
      try { who = await verifyIdToken(action, b.credential); }
      catch (e) { return res.status(401).json({ error: 'No se pudo verificar su cuenta de ' + (action === 'google' ? 'Google' : 'Apple') + '.' }); }
      // Apple solo entrega el nombre la primera vez, y lo entrega aparte del token
      if (!who.name) who.name = clean(b.name, 120) || '';
    }
    const col = action === 'google' ? 'google_sub' : 'apple_sub';
    let rows = action === 'google' ? await sql`select * from users where google_sub = ${who.sub}` : await sql`select * from users where apple_sub = ${who.sub}`;
    if (!rows.length) {
      // mismo correo, ya verificado por el proveedor: es la misma persona; se le suma esta forma de ingreso
      rows = await sql`select * from users where email = ${who.email}`;
      if (rows.length) {
        if (rows[0][col] && rows[0][col] !== who.sub) return res.status(409).json({ error: 'Ese correo ya está vinculado a otra cuenta de ese proveedor.' });
        if (action === 'google') await sql`update users set google_sub = ${who.sub} where id = ${rows[0].id}`;
        else await sql`update users set apple_sub = ${who.sub} where id = ${rows[0].id}`;
      }
    }
    if (rows.length) { setSession(res, rows[0].id); return res.json({ user: publicUser(rows[0]) }); }

    if (!b.pending) return res.json({ needsProfile: true, pending: signPending(who), email: who.email, name: who.name });
    const out = await createAccount(Object.assign({}, b, { name: b.name || who.name }), { email: who.email, passwordHash: null, [col]: who.sub });
    if (out.error) return res.status(out.status).json({ error: out.error });
    setSession(res, out.user.id);
    return res.status(201).json({ user: publicUser(out.user) });
  }

  return res.status(400).json({ error: 'Acción desconocida.' });
});
