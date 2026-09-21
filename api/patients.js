import { sql, canAccessPatient, newLinkCode } from './_lib/db.js';
import { handler, requireUser } from './_lib/auth.js';
import { patientOut, clean } from './_lib/shape.js';

async function load(id) {
  const rows = await sql`
    select p.id, p.user_id, p.name, to_char(p.dob, 'YYYY-MM-DD') as dob, p.id_num, p.diagnosis,
           p.specialty, p.phone, p.obs, p.link_code, p.created_by, p.created_at
    from patients p where p.id = ${id}`;
  return rows[0];
}

export default handler(async function (req, res) {
  const u = await requireUser(req, res); if (!u) return;
  const b = req.body || {};
  const action = req.query.action;

  // Sumarse al equipo tratante de un caso con el código que comparte el paciente o su profesional.
  if (req.method === 'POST' && action === 'link') {
    if (u.role === 'paciente') return res.status(403).json({ error: 'Solo profesionales y farmaceutas pueden vincular casos.' });
    const code = String(b.code || '').trim().toUpperCase();
    const found = await sql`select id, created_by from patients where link_code = ${code}`;
    if (!found.length) return res.status(404).json({ error: 'Código de caso no encontrado.' });
    if (found[0].created_by !== u.id) {
      await sql`insert into care_team (patient_id, user_id) values (${found[0].id}, ${u.id}) on conflict do nothing`;
    }
    return res.json({ patient: patientOut(await load(found[0].id), u.id) });
  }

  if (req.method === 'POST' && action === 'unlink') {
    await sql`delete from care_team where patient_id = ${Number(b.id)} and user_id = ${u.id}`;
    return res.json({ ok: true });
  }

  if (req.method === 'POST') {
    if (u.role !== 'profesional') return res.status(403).json({ error: 'Solo un profesional de la salud puede crear fichas de paciente.' });
    const name = clean(b.name, 120);
    if (!name) return res.status(400).json({ error: 'Ingresa el nombre.' });
    const rows = await sql`
      insert into patients (name, dob, id_num, diagnosis, specialty, phone, obs, link_code, created_by)
      values (${name}, ${/^\d{4}-\d{2}-\d{2}$/.test(String(b.dob || '')) ? b.dob : null}, ${clean(b.idNum, 40)}, ${clean(b.diagnosis, 300)}, ${clean(b.specialty, 80)},
              ${clean(b.phone, 40)}, ${clean(b.obs, 1000)}, ${newLinkCode()}, ${u.id})
      returning id`;
    return res.status(201).json({ patient: patientOut(await load(rows[0].id), u.id) });
  }

  const id = Number(req.query.id);
  if (!id || !(await canAccessPatient(u.id, id))) return res.status(404).json({ error: 'Paciente no encontrado.' });

  if (req.method === 'PUT') {
    if (u.role === 'farmaceuta') return res.status(403).json({ error: 'Tu rol no permite editar la ficha.' });
    const name = clean(b.name, 120);
    if (!name) return res.status(400).json({ error: 'Ingresa el nombre.' });
    await sql`
      update patients set name = ${name}, dob = ${/^\d{4}-\d{2}-\d{2}$/.test(String(b.dob || '')) ? b.dob : null}, id_num = ${clean(b.idNum, 40)},
        diagnosis = ${clean(b.diagnosis, 300)}, specialty = ${clean(b.specialty, 80)}, phone = ${clean(b.phone, 40)}, obs = ${clean(b.obs, 1000)}
      where id = ${id}`;
    return res.json({ patient: patientOut(await load(id), u.id) });
  }

  if (req.method === 'DELETE') {
    const p = await load(id);
    if (p.created_by !== u.id || (p.user_id && p.user_id !== u.id)) {
      return res.status(403).json({ error: 'Solo quien creó la ficha puede eliminarla, y no si el paciente ya tiene cuenta.' });
    }
    if (p.user_id === u.id) return res.status(403).json({ error: 'No puedes eliminar tu propia ficha.' });
    await sql`delete from patients where id = ${id}`;
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'Método no permitido.' });
});
