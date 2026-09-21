import { sql, canAccessPatient } from './_lib/db.js';
import { handler, requireUser } from './_lib/auth.js';
import { clean } from './_lib/shape.js';

// Notas de seguimiento del caso: las escribe y lee el equipo tratante, no el paciente.
export default handler(async function (req, res) {
  const u = await requireUser(req, res); if (!u) return;
  if (u.role === 'paciente') return res.status(403).json({ error: 'Las notas de seguimiento son del equipo tratante.' });

  const patientId = Number(req.method === 'GET' ? req.query.patientId : (req.body || {}).patientId);
  if (!patientId || !(await canAccessPatient(u.id, patientId))) return res.status(404).json({ error: 'Paciente no encontrado.' });

  if (req.method === 'POST') {
    const note = clean((req.body || {}).note, 4001);
    if (!note) return res.status(400).json({ error: 'Escribe la nota.' });
    if (note.length > 4000) return res.status(400).json({ error: 'La nota es demasiado larga.' });
    await sql`insert into case_notes (patient_id, author_id, note) values (${patientId}, ${u.id}, ${note})`;
  } else if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const rows = await sql`
    select n.id, n.note, n.created_at, us.name as author, us.role, us.profession
    from case_notes n left join users us on us.id = n.author_id
    where n.patient_id = ${patientId} order by n.created_at desc limit 200`;
  res.json({ notes: rows });
});
