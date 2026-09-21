const root = '/Users/leo/Medtopix/api/';
const mods = {};
for (const m of ['auth', 'state', 'patients', 'treatments', 'adherence', 'notes']) mods[m] = (await import(root + m + '.js')).default;
const { sql } = await import(root + '_lib/db.js');

async function call(mod, method, query, body, cookie) {
  const req = { method, query: query || {}, body, headers: cookie ? { cookie } : {} };
  const out = { status: 200, headers: {} };
  const res = {
    headersSent: false,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    status(c) { out.status = c; return res; },
    json(j) { out.body = j; res.headersSent = true; return res; }
  };
  await mods[mod](req, res);
  const sc = out.headers['set-cookie'];
  out.cookie = sc ? sc.split(';')[0] : null;
  return out;
}
let fails = 0;
function check(label, cond, extra) { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  -> ' + JSON.stringify(extra))); }

const tag = Date.now();
const mail = function (n) { return n + tag + '@test.medtopix.invalid'; };
const reg = function (o) { return call('auth', 'POST', { action: 'register' }, Object.assign({ password: 'clave-segura-1', terms: true }, o)); };

let r = await reg({ email: mail('doc'), name: 'Dra Prueba', role: 'profesional', profession: 'medico' });
check('registro profesional', r.status === 201 && r.cookie, r); const doc = r.cookie;
r = await reg({ email: mail('doc'), name: 'Dup', role: 'profesional' }); check('correo duplicado -> 409', r.status === 409, r);
r = await reg({ email: mail('x'), name: 'X', role: 'admin' }); check('rol inválido -> 400', r.status === 400, r);
r = await reg({ email: mail('y'), name: 'Y', role: 'paciente', password: 'corta' }); check('clave corta -> 400', r.status === 400, r);
r = await call('auth', 'POST', { action: 'login' }, { email: mail('doc'), password: 'mala' }); check('login clave mala -> 401', r.status === 401, r);
r = await call('auth', 'POST', { action: 'login' }, { email: mail('DOC').toUpperCase(), password: 'clave-segura-1' }); check('login ok (correo sin distinguir mayúsculas)', r.status === 200, r);
r = await call('state', 'GET'); check('state sin sesión -> 401', r.status === 401, r);
r = await call('state', 'GET', {}, null, doc.slice(0, -3) + 'abc'); check('cookie alterada -> 401', r.status === 401, r);

r = await call('patients', 'POST', {}, { name: 'Paciente Uno', dob: '1960-03-15', diagnosis: 'Glaucoma', specialty: 'oftalmologia' }, doc);
check('profesional crea paciente', r.status === 201 && r.body.patient.linkCode, r); const pt = r.body.patient;
check('dob vuelve como texto YYYY-MM-DD', pt.dob === '1960-03-15', pt.dob);
r = await call('treatments', 'POST', {}, { name: 'Timolol 0.5%', time: '08:00', patientId: pt.id, dose: '1 gota', kind: 'farmacologico' }, doc);
check('profesional formula tratamiento', r.status === 201, r); const med = r.body.med;
r = await call('treatments', 'POST', {}, { name: 'Dieta hiposódica', time: '12:00', patientId: pt.id, kind: 'nutricional' }, doc);
check('tratamiento nutricional', r.status === 201 && r.body.med.kind === 'nutricional', r);

r = await reg({ email: mail('pac'), name: 'Paciente Uno', role: 'paciente', linkCode: 'ZZZZ-ZZZZ' }); check('código inexistente -> 400', r.status === 400, r);
r = await reg({ email: mail('pac'), name: 'Paciente Uno', role: 'paciente', linkCode: pt.linkCode.toLowerCase() });
check('paciente se registra con código del caso', r.status === 201, r); const pac = r.cookie;
r = await call('state', 'GET', {}, null, pac);
check('paciente ve su ficha y sus 2 tratamientos', r.body.patients.length === 1 && r.body.patients[0].isSelf && r.body.meds.length === 2, r.body);
r = await call('adherence', 'POST', {}, { medId: med.id, date: '2026-09-20', status: 'yes', scheduledTime: '08:00', actualTime: '08:05' }, pac);
check('paciente registra adherencia', r.status === 200, r);
r = await call('adherence', 'POST', {}, { medId: med.id, date: '2026-09-20', status: 'late', scheduledTime: '08:00', actualTime: '10:00' }, pac);
check('re-registro mismo día actualiza (upsert)', r.status === 200, r);
r = await call('treatments', 'DELETE', { id: med.id }, null, pac); check('paciente NO borra lo formulado por el médico', r.status === 404, r);
r = await call('treatments', 'POST', {}, { name: 'Lágrimas artificiales', time: '21:00', patientId: 999999 }, pac);
check('recordatorio propio del paciente queda en su ficha', r.status === 201 && r.body.med.patientId === pt.id, r);
r = await call('notes', 'GET', { patientId: pt.id }, null, pac); check('paciente no lee notas del equipo -> 403', r.status === 403, r);
r = await call('patients', 'POST', {}, { name: 'Otro' }, pac); check('paciente no crea fichas -> 403', r.status === 403, r);

r = await reg({ email: mail('far'), name: 'QF Prueba', role: 'farmaceuta' }); const far = r.cookie;
r = await call('state', 'GET', {}, null, far); check('farmaceuta sin casos no ve nada', r.body.patients.length === 0 && r.body.meds.length === 0, r.body);
r = await call('adherence', 'POST', {}, { medId: med.id, date: '2026-09-20', status: 'no' }, far); check('farmaceuta sin vínculo no toca adherencia -> 404', r.status === 404, r);
r = await call('notes', 'GET', { patientId: pt.id }, null, far); check('farmaceuta sin vínculo no ve notas -> 404', r.status === 404, r);
r = await call('patients', 'POST', { action: 'link' }, { code: pt.linkCode }, far); check('farmaceuta se vincula con código', r.status === 200, r);
r = await call('state', 'GET', {}, null, far);
check('farmaceuta ve caso, 3 tratamientos y adherencia', r.body.patients.length === 1 && r.body.meds.length === 3 && r.body.adherence.length === 1 && r.body.adherence[0].status === 'late', r.body);
r = await call('treatments', 'POST', {}, { name: 'X', time: '09:00', patientId: pt.id }, far); check('farmaceuta no formula -> 403', r.status === 403, r);
r = await call('notes', 'POST', {}, { patientId: pt.id, note: 'Paciente reclama medicamento a tiempo.' }, far); check('farmaceuta deja nota', r.status === 200 && r.body.notes.length === 1, r);

r = await reg({ email: mail('nut'), name: 'Nutri Ajena', role: 'profesional', profession: 'nutricionista' }); const nut = r.cookie;
r = await call('patients', 'PUT', { id: pt.id }, { name: 'Hack' }, nut); check('profesional ajeno no edita paciente -> 404', r.status === 404, r);
r = await call('treatments', 'PUT', { id: med.id }, { name: 'Hack' }, nut); check('profesional ajeno no edita tratamiento -> 404', r.status === 404, r);

r = await call('state', 'GET', {}, null, doc);
check('médico ve equipo tratante y adherencia del paciente', r.body.patients[0].team.length === 2 && r.body.patients[0].hasAccount && r.body.adherence.length === 1, r.body);
r = await call('treatments', 'PUT', { id: med.id }, { time: '07:30' }, doc); check('médico edita hora conservando el resto', r.body.med.time === '07:30' && r.body.med.dose === '1 gota', r);
r = await call('adherence', 'DELETE', { medId: String(med.id), date: '2026-09-20' }, null, doc); check('deshacer registro', r.status === 200, r);
r = await call('patients', 'DELETE', { id: pt.id }, null, doc); check('no se borra ficha de paciente con cuenta -> 403', r.status === 403, r);

const stored = await sql`select password_hash from users where email = ${mail('doc')}`;
check('contraseña guardada como hash scrypt', stored[0].password_hash.startsWith('scrypt$') && !stored[0].password_hash.includes('clave-segura'), null);

await sql`delete from patients where created_by in (select id from users where email like '%@test.medtopix.invalid') or user_id in (select id from users where email like '%@test.medtopix.invalid')`;
await sql`delete from users where email like '%@test.medtopix.invalid'`;
const left = await sql`select (select count(*) from users)::int u, (select count(*) from patients)::int p, (select count(*) from treatments)::int t, (select count(*) from adherence)::int a, (select count(*) from case_notes)::int n`;
console.log('filas restantes tras limpiar:', JSON.stringify(left[0]));
console.log(fails ? ('FALLARON ' + fails) : 'TODO OK');
