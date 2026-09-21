import { sql } from './db.js';
import { sendPush } from './push.js';

// Avisa al equipo tratante cuando una dosis no se cumple, según la regla del tratamiento:
// always = cada dosis perdida · streak = dos seguidas sin cumplir · never = nunca.
// reason: 'none' (sin respuesta) o 'no' (el paciente reportó que no la usó).
export async function escalate(t, reason, scheduledTime) {
  if (!t.patient_id || t.escalate === 'never') return 0;

  if (t.escalate !== 'always') {
    const last = await sql`
      select status from adherence where treatment_id = ${t.id}
      order by date desc, scheduled_time desc limit 2`;
    const streak = last.length === 2 && last.every(function (a) { return a.status === 'no' || a.status === 'none'; });
    if (!streak) return 0;
    // una racha ya avisada en las últimas 24 h no se repite en cada dosis
    const recent = await sql`
      select 1 from alerts where treatment_id = ${t.id} and kind = 'streak' and created_at > now() - interval '24 hours' limit 1`;
    if (recent.length) return 0;
  }

  const p = (await sql`select id, name, user_id, created_by from patients where id = ${t.patient_id}`)[0];
  if (!p) return 0;
  const team = await sql`
    select u.id from users u
    where u.role <> 'paciente' and u.id <> coalesce(${p.user_id}, 0)
      and (u.id = ${p.created_by} or exists (select 1 from care_team c where c.patient_id = ${p.id} and c.user_id = u.id))`;
  const ids = team.map(function (u) { return u.id; });
  if (!ids.length) return 0;

  const kind = t.escalate === 'always' ? 'missed' : 'streak';
  const what = reason === 'no' ? 'reportó que no usó' : 'no confirmó';
  const message = kind === 'streak'
    ? p.name + ': dos dosis seguidas sin cumplir de ' + t.name + ' (última: ' + scheduledTime + ').'
    : p.name + ' ' + what + ' la dosis de las ' + scheduledTime + ' de ' + t.name + '.';
  for (const uid of ids) {
    await sql`insert into alerts (user_id, patient_id, treatment_id, kind, message) values (${uid}, ${p.id}, ${t.id}, ${kind}, ${message})`;
  }
  await sendPush(ids, { title: '⚠️ MedTopix · dosis sin cumplir', body: message, tag: 'mt-alert-' + t.id, url: '/app#alertas' });
  return ids.length;
}
