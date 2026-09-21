import { sql, canAccessPatient } from './_lib/db.js';
import { handler, requireActive } from './_lib/auth.js';
import { treatmentOut, clean } from './_lib/shape.js';

const KINDS = ['farmacologico', 'nutricional'];
const ESCALATE = ['always', 'streak', 'never'];

// El paciente solo modifica los recordatorios que él mismo creó; el farmaceuta solo consulta.
async function canModify(u, t) {
  if (u.role === 'farmaceuta') return false;
  if (u.role === 'paciente') return t.owner_id === u.id;
  if (t.owner_id === u.id) return true;
  return t.patient_id ? canAccessPatient(u.id, t.patient_id) : false;
}

export default handler(async function (req, res) {
  const u = await requireActive(req, res); if (!u) return;
  const b = req.body || {};

  if (req.method === 'POST') {
    if (u.role === 'farmaceuta') return res.status(403).json({ error: 'Tu rol permite consultar y dejar notas, no formular tratamientos.' });
    const name = clean(b.name, 160);
    if (!name) return res.status(400).json({ error: 'Ingresa el nombre.' });
    if (!/^\d{2}:\d{2}$/.test(String(b.time || ''))) return res.status(400).json({ error: 'Selecciona la hora.' });

    let patientId = b.patientId ? Number(b.patientId) : null;
    if (u.role === 'paciente') {
      const self = await sql`select id from patients where user_id = ${u.id}`;
      patientId = self.length ? self[0].id : null;
    } else if (patientId && !(await canAccessPatient(u.id, patientId))) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }
    const rows = await sql`
      insert into treatments (owner_id, patient_id, kind, name, specialty, dose, time, freq, maxdose, route, notes, escalate)
      values (${u.id}, ${patientId}, ${KINDS.includes(b.kind) ? b.kind : 'farmacologico'}, ${name}, ${clean(b.specialty, 80)},
              ${clean(b.dose, 160)}, ${b.time}, ${clean(b.freq, 60)}, ${clean(b.maxdose, 60)}, ${clean(b.route, 60)}, ${clean(b.notes, 1000)},
              ${ESCALATE.includes(b.escalate) ? b.escalate : 'streak'})
      returning *`;
    return res.status(201).json({ med: treatmentOut(rows[0], u.id) });
  }

  const id = Number(req.query.id);
  const found = id ? await sql`select * from treatments where id = ${id}` : [];
  if (!found.length || !(await canModify(u, found[0]))) return res.status(404).json({ error: 'Tratamiento no encontrado o sin permiso.' });
  const t = found[0];

  if (req.method === 'PUT') {
    const name = b.name === undefined ? t.name : clean(b.name, 160);
    const time = b.time === undefined ? t.time : String(b.time);
    if (!name || !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'Nombre y hora son obligatorios.' });
    const pick = function (key, col) { return b[key] === undefined ? t[col] : clean(b[key], 1000); };
    const rows = await sql`
      update treatments set name = ${name}, time = ${time}, dose = ${pick('dose', 'dose')}, freq = ${pick('freq', 'freq')},
        maxdose = ${pick('maxdose', 'maxdose')}, route = ${pick('route', 'route')}, notes = ${pick('notes', 'notes')},
        specialty = ${pick('specialty', 'specialty')}, kind = ${KINDS.includes(b.kind) ? b.kind : t.kind},
        escalate = ${ESCALATE.includes(b.escalate) ? b.escalate : t.escalate}
      where id = ${id} returning *`;
    return res.json({ med: treatmentOut(rows[0], u.id) });
  }

  if (req.method === 'DELETE') {
    await sql`delete from treatments where id = ${id}`;
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Método no permitido.' });
});
