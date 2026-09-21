import { sql } from './_lib/db.js';
import { handler } from './_lib/auth.js';
import { doseTimes, localClock, toMinute } from './_lib/doses.js';
import { sendPush } from './_lib/push.js';
import { escalate } from './_lib/escalate.js';

const REMIND2_AFTER = 15;  // minutos sin respuesta para el segundo aviso
const MISSED_AFTER = 60;   // minutos sin respuesta para registrar "sin respuesta" y escalar
const GIVE_UP_AFTER = 180; // pasado este margen ya no se procesa (evita avisos viejos tras una caída)

// Lo llama el cron de Vercel cada minuto. Es idempotente: dose_events recuerda qué aviso ya salió.
export default handler(async function (req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  const now = new Date();

  // A quién le suena: al paciente si tiene cuenta; si no, a quien registró la ficha;
  // y al dueño cuando el recordatorio no tiene paciente.
  const rows = await sql`
    select t.id, t.name, t.dose, t.time, t.freq, t.escalate, t.patient_id, t.created_at,
           p.name as patient_name, coalesce(p.user_id, p.created_by, t.owner_id) as notify_id,
           (p.user_id is not null or t.patient_id is null) as self_managed, u.tz
    from treatments t
    left join patients p on p.id = t.patient_id
    left join users u on u.id = coalesce(p.user_id, p.created_by, t.owner_id)`;
  if (!rows.length) return res.json({ ok: true, treatments: 0 });

  const ids = rows.map(function (t) { return t.id; });
  const recorded = await sql`
    select treatment_id, to_char(date, 'YYYY-MM-DD') as date, scheduled_time from adherence
    where treatment_id = any(${ids}) and date >= current_date - 2`;
  const events = await sql`
    select treatment_id, to_char(date, 'YYYY-MM-DD') as date, scheduled_time, kind from dose_events
    where treatment_id = any(${ids}) and date >= current_date - 2`;
  const has = new Set(recorded.map(function (a) { return a.treatment_id + '|' + a.date + '|' + a.scheduled_time; }));
  const done = new Set(events.map(function (e) { return e.treatment_id + '|' + e.date + '|' + e.scheduled_time + '|' + e.kind; }));

  const stats = { remind1: 0, remind2: 0, missed: 0, escalated: 0 };
  for (const t of rows) {
    const clock = localClock(t.tz, now);
    const createdAgo = (now - new Date(t.created_at)) / 60000;
    for (const time of doseTimes(t.time, t.freq)) {
      for (const day of [{ date: clock.date, add: 0 }, { date: clock.yesterday, add: 1440 }]) {
        const late = clock.minute + day.add - toMinute(time); // minutos desde la hora programada
        if (late < 0 || late >= GIVE_UP_AFTER) continue;
        if (late > createdAgo) continue;                       // la dosis es anterior al tratamiento
        const key = t.id + '|' + day.date + '|' + time;
        if (has.has(key)) continue;                            // ya la registraron

        const kind = late >= MISSED_AFTER ? 'missed' : late >= REMIND2_AFTER ? 'remind2' : 'remind1';
        if (done.has(key + '|' + kind)) continue;
        const claimed = await sql`
          insert into dose_events (treatment_id, date, scheduled_time, kind) values (${t.id}, ${day.date}, ${time}, ${kind})
          on conflict do nothing returning 1`;
        if (!claimed.length) continue;                         // otra ejecución se adelantó

        if (kind === 'missed') {
          await sql`
            insert into adherence (treatment_id, patient_id, date, status, scheduled_time, med_name, ts)
            values (${t.id}, ${t.patient_id}, ${day.date}, 'none', ${time}, ${t.name}, ${Date.now()})
            on conflict do nothing`;
          stats.missed++;
          // sin cuenta del paciente quien registra es el propio profesional: avisarle a él mismo sería ruido
          if (t.patient_id && t.self_managed) stats.escalated += await escalate(t, 'none', time);
        } else {
          const who = t.self_managed ? '' : ' — ' + t.patient_name;
          await sendPush([t.notify_id], {
            title: kind === 'remind1' ? '💊 Hora de su tratamiento' : '⏰ Aún sin confirmar',
            body: t.name + who + ' · ' + time + (t.dose ? ' · ' + t.dose : ''),
            tag: 'mt-dose-' + t.id + '-' + time, url: '/app#alerts',
            dose: { medId: t.id, date: day.date, scheduledTime: time }
          });
          stats[kind]++;
        }
      }
    }
  }
  res.json({ ok: true, treatments: rows.length, ...stats });
});
