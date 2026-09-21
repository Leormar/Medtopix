import { sql } from './_lib/db.js';
import { handler, requireUser, publicUser, isVerified } from './_lib/auth.js';
import { patientOut, treatmentOut, adherenceOut } from './_lib/shape.js';

// Carga inicial: todo lo que el usuario puede ver según su rol y los casos que sigue.
export default handler(async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  const u = await requireUser(req, res); if (!u) return;

  // cuenta pendiente: puede entrar y ver su estado, pero no recibe ningún dato de pacientes
  if (!isVerified(u)) return res.json({ user: publicUser(u), pending: true, patients: [], meds: [], adherence: [], unreadAlerts: 0 });

  // la zona horaria del dispositivo fija a qué hora local suenan los avisos del servidor
  const tz = String(req.query.tz || '');
  if (/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(tz) && tz.length < 64 && tz !== u.tz) await sql`update users set tz = ${tz} where id = ${u.id}`;

  const patients = await sql`
    select p.id, p.user_id, p.name, to_char(p.dob, 'YYYY-MM-DD') as dob, p.id_num, p.diagnosis,
           p.specialty, p.phone, p.obs, p.link_code, p.created_by, p.created_at
    from patients p
    where p.created_by = ${u.id} or p.user_id = ${u.id}
       or exists (select 1 from care_team c where c.patient_id = p.id and c.user_id = ${u.id})
    order by p.created_at desc`;
  const ids = patients.map(function (p) { return p.id; });

  const treatments = await sql`
    select * from treatments
    where owner_id = ${u.id} or patient_id = any(${ids})
    order by created_at desc`;
  const tids = treatments.map(function (t) { return t.id; });

  const adherence = await sql`
    select treatment_id, patient_id, to_char(date, 'YYYY-MM-DD') as date, status,
           scheduled_time, actual_time, ts, med_name
    from adherence where treatment_id = any(${tids})
    order by ts`;

  const unread = await sql`select count(*)::int as n from alerts where user_id = ${u.id} and read_at is null`;

  const team = await sql`
    select c.patient_id, us.name, us.role, us.profession
    from care_team c join users us on us.id = c.user_id
    where c.patient_id = any(${ids})
    union
    select p.id, us.name, us.role, us.profession
    from patients p join users us on us.id = p.created_by
    where p.id = any(${ids}) and us.role <> 'paciente'`;

  res.json({
    user: publicUser(u),
    patients: patients.map(function (p) {
      const out = patientOut(p, u.id);
      out.team = team.filter(function (t) { return t.patient_id === p.id; })
        .map(function (t) { return { name: t.name, role: t.role, profession: t.profession }; });
      return out;
    }),
    meds: treatments.map(function (t) { return treatmentOut(t, u.id); }),
    adherence: adherence.map(adherenceOut),
    unreadAlerts: unread[0].n
  });
});
