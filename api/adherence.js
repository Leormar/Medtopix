import { sql, canAccessPatient } from './_lib/db.js';
import { handler, requireUser } from './_lib/auth.js';
import { escalate } from './_lib/escalate.js';

const STATUS = ['yes', 'late', 'no'];
const hhmm = function (v) { return /^\d{2}:\d{2}$/.test(String(v || '')) ? v : null; };

export default handler(async function (req, res) {
  const u = await requireUser(req, res); if (!u) return;
  const b = req.method === 'DELETE' ? req.query : (req.body || {});
  const medId = Number(b.medId);
  const date = String(b.date || '');
  if (!medId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Datos incompletos.' });

  const found = await sql`select * from treatments where id = ${medId}`;
  const t = found[0];
  const allowed = t && (t.owner_id === u.id || (t.patient_id && await canAccessPatient(u.id, t.patient_id)));
  if (!allowed) return res.status(404).json({ error: 'Tratamiento no encontrado.' });

  // Cada dosis del día es un registro aparte, identificado por su hora programada.
  const scheduled = hhmm(b.scheduledTime) || '';

  if (req.method === 'POST') {
    if (!STATUS.includes(b.status)) return res.status(400).json({ error: 'Estado no válido.' });
    await sql`
      insert into adherence (treatment_id, patient_id, date, status, scheduled_time, actual_time, med_name, recorded_by, ts)
      values (${medId}, ${t.patient_id}, ${date}, ${b.status}, ${scheduled}, ${hhmm(b.actualTime)},
              ${t.name}, ${u.id}, ${Date.now()})
      on conflict (treatment_id, date, scheduled_time) do update set status = excluded.status,
        actual_time = excluded.actual_time, recorded_by = excluded.recorded_by, ts = excluded.ts`;
    if (b.status === 'no' && u.role === 'paciente') await escalate(t, 'no', scheduled);
    return res.json({ ok: true });
  }
  if (req.method === 'DELETE') {
    await sql`delete from adherence where treatment_id = ${medId} and date = ${date} and scheduled_time = ${scheduled}`;
    return res.json({ ok: true });
  }
  res.status(405).json({ error: 'Método no permitido.' });
});
