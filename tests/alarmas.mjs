const root = '/Users/leo/Medtopix/api/';
const mods = {};
for (const m of ['auth', 'state', 'patients', 'treatments', 'adherence', 'cron', 'alerts', 'keys', 'push']) mods[m] = (await import(root + m + '.js')).default;
const { sql } = await import(root + '_lib/db.js');
const { localClock } = await import(root + '_lib/doses.js');
const { requireApiKey } = await import(root + '_lib/auth.js');

async function call(mod, method, query, body, cookie, headers) {
  const req = { method, query: query || {}, body, headers: Object.assign(cookie ? { cookie } : {}, headers || {}) };
  const out = { status: 200, headers: {} };
  const res = { headersSent: false, setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, status(c) { out.status = c; return res; }, json(j) { out.body = j; res.headersSent = true; return res; } };
  await mods[mod](req, res);
  const sc = out.headers['set-cookie']; out.cookie = sc ? sc.split(';')[0] : null;
  return out;
}
let fails = 0;
function check(label, cond, extra) { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  -> ' + JSON.stringify(extra))); }
const tag = Date.now(), mail = n => n + tag + '@test.medtopix.invalid';
const reg = o => call('auth', 'POST', { action: 'register' }, Object.assign({ password: 'clave-segura-1', terms: true }, o));
const tick = () => call('cron', 'GET', {}, null, null, { authorization: 'Bearer ' + process.env.CRON_SECRET });
function ago(min) { const c = localClock('America/Bogota', new Date(Date.now() - min * 60000)); return String(Math.floor(c.minute / 60)).padStart(2, '0') + ':' + String(c.minute % 60).padStart(2, '0'); }

let r = await call('cron', 'GET', {}, null, null, {}); check('cron sin secreto -> 401', r.status === 401, r);
r = await reg({ email: mail('doc'), name: 'Dra Alarmas', role: 'profesional', profession: 'medico' }); const doc = r.cookie;
r = await call('patients', 'POST', {}, { name: 'Paciente Alarmas' }, doc); const pt = r.body.patient;
r = await reg({ email: mail('pac'), name: 'Paciente Alarmas', role: 'paciente', linkCode: pt.linkCode }); const pac = r.cookie;
r = await call('state', 'GET', { tz: 'America/Bogota' }, null, pac); check('state guarda zona horaria y trae unreadAlerts', r.status === 200 && r.body.unreadAlerts === 0, r.body && r.body.unreadAlerts);
const tzRow = await sql`select tz from users where email = ${mail('pac')}`; check('tz guardada', tzRow[0].tz === 'America/Bogota', tzRow);
r = await call('state', 'GET', { tz: "x'; drop table users;--" }, null, pac); check('tz inválida se ignora', r.status === 200 && (await sql`select tz from users where email = ${mail('pac')}`)[0].tz === 'America/Bogota', r.status);

async function med(name, minAgo, escalate) {
  const x = await call('treatments', 'POST', {}, { name, time: ago(minAgo), freq: 'Una vez al día', patientId: pt.id, escalate }, doc);
  await sql`update treatments set created_at = now() - interval '2 days' where id = ${x.body.med.id}`;
  return x.body.med;
}
const mNew = await call('treatments', 'POST', {}, { name: 'Recién creado', time: ago(30), freq: 'Una vez al día', patientId: pt.id }, doc);
const m1 = await med('Aviso 1', 2), m2 = await med('Aviso 2', 20), m3 = await med('Perdida racha', 70, 'streak'), m4 = await med('Perdida siempre', 75, 'always');
check('tratamiento guarda regla de escalamiento', m4.escalate === 'always' && m3.escalate === 'streak' && mNew.body.med.escalate === 'streak', [m3, m4]);

r = await tick(); check('tick: 1 primer aviso, 1 segundo aviso, 2 perdidas', r.body.remind1 === 1 && r.body.remind2 === 1 && r.body.missed === 2, r.body);
check('regla always escala de inmediato; streak aún no', r.body.escalated === 1, r.body);
const ev = await sql`select treatment_id, kind from dose_events where treatment_id = any(${[m1.id, m2.id, m3.id, m4.id, mNew.body.med.id]})`;
check('dosis anterior a la creación del tratamiento no genera avisos', !ev.some(e => e.treatment_id === mNew.body.med.id), ev);
const none = await sql`select treatment_id, status, scheduled_time from adherence where treatment_id = any(${[m3.id, m4.id]})`;
check('perdidas quedan como "none" con su hora programada', none.length === 2 && none.every(a => a.status === 'none' && /^\d\d:\d\d$/.test(a.scheduled_time)), none);
r = await tick(); check('segundo tick no repite nada (idempotente)', r.body.remind1 + r.body.remind2 + r.body.missed + r.body.escalated === 0, r.body);

r = await call('alerts', 'GET', {}, null, doc); check('médico recibe 1 alerta (always)', r.body.unread === 1 && r.body.alerts[0].kind === 'missed' && r.body.alerts[0].message.includes('Perdida siempre'), r.body);
r = await call('alerts', 'GET', {}, null, pac); check('el paciente no recibe alertas del equipo', r.body.unread === 0, r.body);

// racha: ayer "no" + hoy sin respuesta = dos seguidas
const m5 = await med('Racha completa', 65, 'streak');
const y = localClock('America/Bogota', new Date()).yesterday;
await sql`insert into adherence (treatment_id, patient_id, date, status, scheduled_time, med_name, ts) values (${m5.id}, ${pt.id}, ${y}, 'no', ${m5.time}, 'Racha completa', 1)`;
r = await tick(); check('dos seguidas sin cumplir -> escala por racha', r.body.missed === 1 && r.body.escalated === 1, r.body);
r = await call('alerts', 'GET', {}, null, doc); check('alerta de racha en la bandeja', r.body.unread === 2 && r.body.alerts.some(a => a.kind === 'streak'), r.body);
r = await call('alerts', 'POST', {}, { id: r.body.alerts[0].id }, doc); check('marcar una alerta como leída', r.body.unread === 1, r.body);
r = await call('alerts', 'POST', {}, {}, doc); check('marcar todas como leídas', r.body.unread === 0, r.body);

// varias dosis por día
const m6 = await call('treatments', 'POST', {}, { name: 'Tres al día', time: '08:00', freq: 'Cada 8 horas', patientId: pt.id, escalate: 'never' }, doc);
const d = '2026-09-10';
for (const [t, s] of [['00:00', 'yes'], ['08:00', 'late'], ['16:00', 'no']]) await call('adherence', 'POST', {}, { medId: m6.body.med.id, date: d, status: s, scheduledTime: t, actualTime: t }, pac);
let rows = await sql`select scheduled_time, status from adherence where treatment_id = ${m6.body.med.id} order by scheduled_time`;
check('tres dosis del mismo día = tres registros', rows.length === 3 && rows.map(x => x.status).join() === 'yes,late,no', rows);
await call('adherence', 'POST', {}, { medId: m6.body.med.id, date: d, status: 'yes', scheduledTime: '16:00', actualTime: '16:05' }, pac);
await call('adherence', 'DELETE', { medId: String(m6.body.med.id), date: d, scheduledTime: '00:00' }, null, pac);
rows = await sql`select scheduled_time, status from adherence where treatment_id = ${m6.body.med.id} order by scheduled_time`;
check('corregir una dosis y deshacer otra no toca las demás', rows.length === 2 && rows[0].scheduled_time === '08:00' && rows[1].status === 'yes', rows);
r = await call('adherence', 'POST', {}, { medId: m6.body.med.id, date: d, status: 'none', scheduledTime: '08:00' }, pac); check('un usuario no puede registrar "none" -> 400', r.status === 400, r);

// llaves de API
r = await call('keys', 'POST', {}, { name: 'HCE de prueba <b>' }, doc); const key = r.body.created;
check('crear llave: se entrega una vez, formato mtx_', r.status === 201 && /^mtx_[a-f0-9]{48}$/.test(key) && !r.body.keys[0].name.includes('<'), r.body);
const stored = await sql`select key_hash, prefix from api_keys where user_id = (select id from users where email = ${mail('doc')})`;
check('en la base solo queda el hash', stored[0].key_hash.length === 64 && !stored[0].key_hash.includes(key.slice(4)), stored);
r = await call('keys', 'GET', {}, null, doc); check('listar no revela la llave', r.body.created === null && r.body.keys.length === 1 && !JSON.stringify(r.body).includes(key), r.body);
r = await call('keys', 'POST', {}, { name: 'x' }, pac); check('paciente no crea llaves -> 403', r.status === 403, r);
const fake = () => { const o = { s: 200 }; return { o, res: { setHeader() {}, status(c) { o.s = c; return this; }, json() { return this; } } }; };
let f = fake(); let who = await requireApiKey({ headers: { authorization: 'Bearer ' + key } }, f.res); check('llave válida autentica a su dueño', who && who.email === mail('doc'), who);
r = await call('keys', 'DELETE', { id: String(r.body.keys ? 0 : 0) }, null, doc);
const kid = (await sql`select id from api_keys where key_hash = ${stored[0].key_hash}`)[0].id;
await call('keys', 'DELETE', { id: String(kid) }, null, doc);
f = fake(); who = await requireApiKey({ headers: { authorization: 'Bearer ' + key } }, f.res); check('llave revocada -> 401', who === null && f.o.s === 401, f.o);

// push
r = await call('push', 'GET', { action: 'key' }); check('llave pública VAPID disponible', r.body.key && r.body.key.length > 80, r.body);
r = await call('push', 'POST', { action: 'subscribe' }, { subscription: { endpoint: 'http://malo', keys: {} } }, pac); check('suscripción inválida -> 400', r.status === 400, r);
r = await call('push', 'POST', { action: 'subscribe' }, { subscription: { endpoint: 'https://push.example.invalid/' + tag, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } } }, pac);
check('suscripción válida se guarda', r.status === 200, r);
r = await call('push', 'POST', { action: 'test' }, {}, pac); check('envío a un destino caído no rompe la petición', r.status === 200 && r.body.sent === 0, r.body);

await sql`delete from patients where created_by in (select id from users where email like '%@test.medtopix.invalid') or user_id in (select id from users where email like '%@test.medtopix.invalid')`;
await sql`delete from users where email like '%@test.medtopix.invalid'`;
const left = await sql`select (select count(*) from users)::int u, (select count(*) from treatments)::int t, (select count(*) from adherence)::int a, (select count(*) from dose_events)::int e, (select count(*) from alerts)::int al, (select count(*) from api_keys)::int k, (select count(*) from push_subscriptions)::int ps`;
console.log('filas tras limpiar:', JSON.stringify(left[0]));
console.log(fails ? 'FALLARON ' + fails : 'TODO OK');
