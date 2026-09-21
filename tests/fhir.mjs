const root = '/Users/leo/Medtopix/api/';
const fhir = (await import(root + 'fhir.js')).default;
const { sql } = await import(root + '_lib/db.js');
const { newApiKey, hashPassword } = await import(root + '_lib/auth.js');

async function call(method, path, opts) {
  const o = opts || {};
  const query = Object.assign({ path }, o.query || {});
  const headers = { host: 'medtopix.vercel.app' };
  if (o.key) headers.authorization = 'Bearer ' + o.key;
  if (o.auth) headers.authorization = o.auth;
  const req = { method, query, headers, body: o.raw !== undefined ? o.raw : o.body };
  const out = { status: 200, headers: {} };
  const res = {
    headersSent: false, statusCode: 200,
    setHeader(k, v) { out.headers[k.toLowerCase()] = v; },
    status(c) { res.statusCode = c; return res; },
    json(j) { out.body = j; res.headersSent = true; return res; },
    end(s) { out.body = s ? JSON.parse(s) : null; res.headersSent = true; }
  };
  await fhir(req, res);
  out.status = res.statusCode;
  return out;
}
let fails = 0, n = 0;
function check(label, cond, extra) { n++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (cond ? '' : '  -> ' + JSON.stringify(extra).slice(0, 600))); }
const isOO = function (r, code) { return r.body && r.body.resourceType === 'OperationOutcome' && (!code || r.body.issue[0].code === code); };

const tag = Date.now();
async function mkUser(n_, role) {
  const rows = await sql`insert into users (email, password_hash, name, role, profession, tz, terms_accepted_at, verified_at)
    values (${n_ + tag + '@test.medtopix.invalid'}, ${hashPassword('clave-segura-1')}, ${'Prueba ' + n_}, ${role}, ${role === 'profesional' ? 'medico' : null}, ${role === 'paciente' ? 'America/Bogota' : null}, now(), now()) returning id`;
  const k = newApiKey();
  const kr = await sql`insert into api_keys (user_id, name, prefix, key_hash) values (${rows[0].id}, 'prueba', ${k.prefix}, ${k.hash}) returning id`;
  return { id: rows[0].id, key: k.key, keyId: kr[0].id };
}
const doc = await mkUser('fdoc', 'profesional'), otro = await mkUser('fotro', 'profesional'), far = await mkUser('ffar', 'farmaceuta');

try {
  let r = await call('GET', 'metadata');
  check('metadata sin llave → CapabilityStatement', r.status === 200 && r.body.resourceType === 'CapabilityStatement' && r.body.fhirVersion === '4.0.1' && r.body.rest[0].resource.length === 5, r);
  check('Content-Type application/fhir+json', /^application\/fhir\+json/.test(r.headers['content-type']), r.headers);
  r = await call('GET', ''); check('ruta vacía → metadata', r.status === 200 && r.body.resourceType === 'CapabilityStatement', r);
  r = await call('GET', 'Patient'); check('sin llave → 401 OperationOutcome', r.status === 401 && isOO(r, 'login'), r);
  r = await call('GET', 'Patient', { key: 'mtx_' + '0'.repeat(48) }); check('llave inexistente → 401', r.status === 401 && isOO(r), r);
  r = await call('GET', 'Patient', { auth: 'Bearer cualquiercosa' }); check('llave mal formada → 401', r.status === 401, r);
  r = await call('GET', 'Practitioner', { key: doc.key }); check('tipo no soportado → 404', r.status === 404 && isOO(r, 'not-found'), r);

  r = await call('POST', 'Patient', { key: doc.key, body: { resourceType: 'Patient', identifier: [{ system: 'urn:hce:cc', value: 'CC' + tag }], name: [{ given: ['María <img src=x onerror=alert(1)>'], family: "O'Brien" }], birthDate: '1958-04-02', telecom: [{ system: 'email', value: 'x@y.z' }, { system: 'phone', value: '3100000000' }] } });
  check('crear Patient → 201 + Location', r.status === 201 && /\/api\/fhir\/Patient\/\d+$/.test(r.headers.location || ''), r);
  const pt = r.body;
  check('Patient: nombre saneado (sin < > comillas)', pt.name[0].text && !/[<>"']/.test(pt.name[0].text) && pt.name[0].text.includes('María'), pt.name);
  check('Patient: birthDate, teléfono y documento', pt.birthDate === '1958-04-02' && pt.telecom[0].value === '3100000000' && pt.identifier[0].value === 'CC' + tag, pt);
  const caso = pt.identifier.find(function (i) { return i.system.endsWith('/codigo-caso'); });
  check('Patient: incluye código del caso', caso && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(caso.value), pt.identifier);
  const row = (await sql`select * from patients where id = ${Number(pt.id)}`)[0];
  check('Patient en BD: created_by = dueño de la llave, link_code', row.created_by === doc.id && row.link_code === caso.value && row.id_num === 'CC' + tag, row);

  r = await call('POST', 'Patient', { key: doc.key, body: { resourceType: 'Patient', identifier: [{ value: 'CC' + tag }], name: [{ text: 'Otra grafía' }] } });
  check('idempotencia por documento → 200 mismo id', r.status === 200 && r.body.id === pt.id, r);
  const cnt = await sql`select count(*)::int c from patients where id_num = ${'CC' + tag}`;
  check('no se duplicó la ficha', cnt[0].c === 1, cnt);
  r = await call('POST', 'Patient', { key: doc.key, body: { resourceType: 'Patient' } }); check('Patient sin nombre → 400', r.status === 400 && isOO(r, 'required'), r);
  r = await call('POST', 'Patient', { key: doc.key, body: { resourceType: 'Patient', name: [{ text: 'X' }], birthDate: '02/04/1958' } }); check('birthDate inválida → 400', r.status === 400, r);
  r = await call('POST', 'Patient', { key: doc.key, body: { resourceType: 'Observation' } }); check('resourceType equivocado → 400', r.status === 400, r);
  r = await call('POST', 'Patient', { key: doc.key, raw: '{no es json' }); check('JSON inválido (texto) → 400', r.status === 400 && isOO(r, 'invalid'), r);
  r = await call('POST', 'Patient', { key: doc.key, raw: JSON.stringify({ resourceType: 'Patient', name: [{ text: 'Cuerpo Como Texto' }] }) }); check('cuerpo como texto (fhir+json sin interpretar) → 201', r.status === 201, r);

  r = await call('GET', 'Patient', { key: doc.key, query: { identifier: 'urn:hce:cc|CC' + tag } }); check('buscar Patient por identifier system|value', r.status === 200 && r.body.resourceType === 'Bundle' && r.body.type === 'searchset' && r.body.total === 1 && r.body.entry[0].resource.id === pt.id, r);
  r = await call('GET', 'Patient', { key: doc.key, query: { identifier: caso.value.toLowerCase() } }); check('buscar Patient por código del caso', r.body.total === 1, r);
  r = await call('GET', 'Patient', { key: doc.key, query: { name: 'maría' } }); check('buscar Patient por name', r.body.total === 1, r);
  r = await call('GET', 'Patient', { key: doc.key, query: { name: 'zzzz-nadie' } }); check('búsqueda sin resultados → Bundle total 0', r.status === 200 && r.body.total === 0 && r.body.entry.length === 0, r);
  r = await call('GET', 'Patient/' + pt.id, { key: doc.key }); check('leer Patient por id', r.status === 200 && r.body.id === pt.id, r);

  const mrBody = { resourceType: 'MedicationRequest', status: 'active', intent: 'order', subject: { reference: 'Patient/' + pt.id }, medicationCodeableConcept: { text: 'Timolol 0,5 % <b>gotas</b>' }, dosageInstruction: [{ text: '1 gota en cada ojo', timing: { repeat: { frequency: 1, period: 12, periodUnit: 'h', timeOfDay: ['08:00:00'] } }, route: { text: 'Colirio / ocular' } }], note: [{ text: 'No suspender sin indicación.' }] };
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: mrBody });
  check('crear MedicationRequest → 201', r.status === 201 && r.body.resourceType === 'MedicationRequest' && /MedicationRequest\/\d+$/.test(r.headers.location), r);
  const mr = r.body;
  let t = (await sql`select * from treatments where id = ${Number(mr.id)}`)[0];
  check('treatments: campos correctos', t.kind === 'farmacologico' && t.patient_id === Number(pt.id) && t.owner_id === doc.id && t.time === '08:00' && t.freq === 'Cada 12 horas' && t.dose === '1 gota en cada ojo' && t.route === 'Colirio / ocular' && t.notes === 'No suspender sin indicación.' && !/[<>]/.test(t.name), t);
  check('MedicationRequest devuelto: timing y subject', mr.subject.reference === 'Patient/' + pt.id && mr.dosageInstruction[0].timing.repeat.period === 12 && mr.dosageInstruction[0].timing.repeat.timeOfDay[0] === '08:00:00', mr);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { dosageInstruction: [{ asNeededBoolean: true, timing: { repeat: { timeOfDay: ['21:30'] } } }] }) });
  t = (await sql`select * from treatments where id = ${Number(r.body.id)}`)[0];
  check('asNeededBoolean → Según necesidad, hora HH:MM', r.status === 201 && t.freq === 'Según necesidad' && t.time === '21:30' && r.body.dosageInstruction[0].asNeededBoolean === true, r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { dosageInstruction: [{ text: '1 gota cada 8 horas', timing: { repeat: { timeOfDay: ['06:00:00'] } } }] }) });
  t = (await sql`select freq from treatments where id = ${Number(r.body.id)}`)[0];
  check('frecuencia desde texto "cada 8 horas"', r.status === 201 && t.freq === 'Cada 8 horas', r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { dosageInstruction: [{ timing: { repeat: { frequency: 1, period: 5, periodUnit: 'h', timeOfDay: ['06:00:00'] } } }] }) });
  check('frecuencia no soportada (cada 5 h) → 400', r.status === 400 && isOO(r, 'not-supported'), r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { dosageInstruction: [{ text: '1 gota' }] }) }); check('sin hora → 400', r.status === 400 && isOO(r, 'required'), r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { medicationCodeableConcept: {} }) }); check('sin medicamento → 400', r.status === 400, r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { subject: undefined }) }); check('sin paciente → 400', r.status === 400, r);
  r = await call('POST', 'MedicationRequest', { key: doc.key, body: Object.assign({}, mrBody, { subject: { reference: 'Patient/999999999' } }) }); check('paciente inexistente → 404', r.status === 404, r);

  r = await call('POST', 'NutritionOrder', { key: doc.key, body: { resourceType: 'NutritionOrder', status: 'active', intent: 'order', patient: { reference: 'Patient/' + pt.id }, dateTime: '2026-09-20', oralDiet: { instruction: 'Dieta baja en sodio', schedule: [{ repeat: { frequency: 1, period: 1, periodUnit: 'd', timeOfDay: ['12:30:00'] } }] }, note: [{ text: 'Evitar embutidos.' }] } });
  check('crear NutritionOrder → 201', r.status === 201 && r.body.oralDiet.instruction === 'Dieta baja en sodio', r);
  const no = r.body;
  t = (await sql`select * from treatments where id = ${Number(no.id)}`)[0];
  check('treatments: nutricional con hora y frecuencia', t.kind === 'nutricional' && t.time === '12:30' && t.freq === 'Una vez al día' && t.notes === 'Evitar embutidos.', t);
  r = await call('POST', 'NutritionOrder', { key: doc.key, body: { resourceType: 'NutritionOrder', patient: { reference: 'Patient/' + pt.id }, note: [{ text: 'Colación a media mañana' }], oralDiet: { schedule: [{ repeat: { timeOfDay: ['10:00:00'] } }] } } });
  check('NutritionOrder: nombre desde note[0].text', r.status === 201 && r.body.oralDiet.instruction === 'Colación a media mañana', r);

  r = await call('GET', 'MedicationRequest', { key: doc.key, query: { patient: 'Patient/' + pt.id } }); check('buscar MedicationRequest?patient= (solo farmacológicos)', r.body.total === 3 && r.body.entry.every(function (e) { return e.resource.resourceType === 'MedicationRequest'; }), r);
  r = await call('GET', 'NutritionOrder', { key: doc.key, query: { patient: pt.id } }); check('buscar NutritionOrder?patient=', r.body.total === 2, r);
  r = await call('GET', 'MedicationRequest/' + no.id, { key: doc.key }); check('un NutritionOrder no se lee como MedicationRequest → 404', r.status === 404, r);
  r = await call('GET', 'NutritionOrder/' + no.id, { key: doc.key }); check('leer NutritionOrder por id', r.status === 200 && r.body.id === no.id, r);
  r = await call('GET', 'MedicationRequest', { key: doc.key, query: { patient: 'abc' } }); check('patient inválido → 400', r.status === 400, r);

  const tid = Number(mr.id), pid = Number(pt.id), day = function (k) { const d = new Date(); d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); };
  for (const a of [[day(3), 'yes', '08:00', '08:04'], [day(3), 'late', '20:00', '22:15'], [day(2), 'no', '08:00', null], [day(2), 'none', '20:00', null], [day(45), 'no', '08:00', null]]) {
    await sql`insert into adherence (treatment_id, patient_id, date, status, scheduled_time, actual_time, med_name, ts) values (${tid}, ${pid}, ${a[0]}, ${a[1]}, ${a[2]}, ${a[3]}, 'Timolol', ${Date.now()})`;
  }
  await sql`insert into adherence (treatment_id, patient_id, date, status, scheduled_time, med_name, ts) values (${Number(no.id)}, ${pid}, ${day(1)}, 'yes', '12:30', 'Dieta', ${Date.now()})`;
  r = await call('GET', 'MedicationAdministration', { key: doc.key, query: { patient: pt.id, 'effective-time': 'ge' + day(10) } });
  check('MedicationAdministration ge: 4 filas, sin la nutricional ni la antigua', r.status === 200 && r.body.total === 4, r);
  const by = {}; r.body.entry.forEach(function (e) { const x = e.resource; by[x.statusReason ? x.statusReason[0].text : (x.note ? 'late' : 'yes')] = x; });
  check('yes → completed con hora real', by.yes && by.yes.status === 'completed' && by.yes.effectiveDateTime === day(3) + 'T08:04:00-05:00' && by.yes.request.reference === 'MedicationRequest/' + mr.id, by.yes);
  check('late → completed, hora real y nota', by.late && by.late.status === 'completed' && by.late.effectiveDateTime.includes('T22:15:00') && /otro horario/.test(by.late.note[0].text) && by.late.extension[0].valueTime === '20:00:00', by.late);
  check('no → not-done «reporta que no la usó»', by['El paciente reporta que no la usó'] && by['El paciente reporta que no la usó'].status === 'not-done', by);
  check('none → not-done «sin respuesta»', by['Sin respuesta del paciente'] && by['Sin respuesta del paciente'].status === 'not-done' && by['Sin respuesta del paciente'].effectiveDateTime.includes('T20:00:00'), by);
  r = await call('GET', 'MedicationAdministration', { key: doc.key, query: { patient: pt.id, 'effective-time': ['ge' + day(2), 'le' + day(2)] } }); check('rango ge+le → 2 filas', r.body.total === 2, r);
  r = await call('GET', 'MedicationAdministration', { key: doc.key, query: { patient: pt.id, 'effective-time': 'lt' + day(10) } }); check('prefijo lt → solo la antigua', r.body.total === 1, r);
  r = await call('GET', 'MedicationAdministration', { key: doc.key, query: { 'effective-time': 'ayer' } }); check('fecha inválida → 400', r.status === 400, r);
  r = await call('GET', 'MedicationAdministration/' + by.yes.id, { key: doc.key }); check('leer MedicationAdministration por id', r.status === 200 && r.body.id === by.yes.id, r);
  r = await call('POST', 'MedicationAdministration', { key: doc.key, body: { resourceType: 'MedicationAdministration' } }); check('POST a recurso de solo lectura → 405', r.status === 405 && isOO(r), r);
  r = await call('DELETE', 'Patient/' + pt.id, { key: doc.key }); check('DELETE → 405', r.status === 405, r);

  r = await call('GET', 'Observation', { key: doc.key, query: { patient: pt.id, code: 'adherence' } });
  const ob = r.body.entry.map(function (e) { return e.resource; }).find(function (o) { return o.id === 'adh-' + mr.id; });
  check('Observation: una por tratamiento (5)', r.status === 200 && r.body.total === 5, r);
  check('Observation: 50 % en 30 días (none cuenta como no adherente, la de hace 45 días no entra)', ob && ob.valueQuantity.value === 50 && ob.valueQuantity.unit === '%' && ob.focus[0].reference === 'MedicationRequest/' + mr.id, ob);
  const comp = {}; ob.component.forEach(function (c) { comp[c.code.coding[0].code] = c.valueInteger; });
  check('Observation: conteos por estado', comp['adherence-count-yes'] === 1 && comp['adherence-count-late'] === 1 && comp['adherence-count-no'] === 1 && comp['adherence-count-none'] === 1, comp);
  check('Observation: código local, no LOINC', ob.code.coding[0].system.includes('medtopix.vercel.app') && ob.code.coding[0].code === 'adherence-30d', ob.code);
  const vacio = r.body.entry.map(function (e) { return e.resource; }).find(function (o) { return !o.valueQuantity; });
  check('Observation sin registros → dataAbsentReason', vacio && vacio.dataAbsentReason, vacio);
  r = await call('GET', 'Observation/adh-' + no.id, { key: doc.key }); check('leer Observation por id (nutricional → focus NutritionOrder, 100 %)', r.status === 200 && r.body.valueQuantity.value === 100 && r.body.focus[0].reference === 'NutritionOrder/' + no.id, r);
  r = await call('GET', 'Observation', { key: doc.key, query: { patient: pt.id, code: 'http://loinc.org|1234-5' } }); check('Observation con otro code → Bundle vacío', r.body.total === 0, r);

  r = await call('GET', 'Patient', { key: otro.key }); check('aislamiento: otro profesional no ve pacientes', r.status === 200 && r.body.total === 0, r);
  r = await call('GET', 'Patient/' + pt.id, { key: otro.key }); check('aislamiento: Patient por id → 404', r.status === 404, r);
  r = await call('GET', 'MedicationRequest/' + mr.id, { key: otro.key }); check('aislamiento: MedicationRequest por id → 404', r.status === 404, r);
  r = await call('GET', 'MedicationAdministration/' + by.yes.id, { key: otro.key }); check('aislamiento: MedicationAdministration por id → 404', r.status === 404, r);
  r = await call('GET', 'Observation/adh-' + mr.id, { key: otro.key }); check('aislamiento: Observation por id → 404', r.status === 404, r);
  r = await call('GET', 'MedicationAdministration', { key: otro.key, query: { patient: pt.id } }); check('aislamiento: búsqueda por paciente ajeno → vacío', r.body.total === 0, r);
  r = await call('POST', 'MedicationRequest', { key: otro.key, body: mrBody }); check('aislamiento: no formula a paciente ajeno → 404', r.status === 404, r);

  await sql`insert into care_team (patient_id, user_id) values (${pid}, ${far.id})`;
  r = await call('GET', 'MedicationRequest', { key: far.key, query: { patient: pt.id } }); check('farmaceuta vinculado: lee', r.status === 200 && r.body.total === 3, r);
  r = await call('POST', 'MedicationRequest', { key: far.key, body: mrBody }); check('farmaceuta: POST MedicationRequest → 403', r.status === 403 && isOO(r, 'forbidden'), r);
  r = await call('POST', 'Patient', { key: far.key, body: { resourceType: 'Patient', name: [{ text: 'X' }] } }); check('farmaceuta: POST Patient → 403', r.status === 403, r);

  await sql`update api_keys set revoked_at = now() where id = ${doc.keyId}`;
  r = await call('GET', 'Patient', { key: doc.key }); check('llave revocada → 401', r.status === 401 && isOO(r), r);
} finally {
  await sql`delete from patients where created_by in (select id from users where email like '%@test.medtopix.invalid') or user_id in (select id from users where email like '%@test.medtopix.invalid')`;
  await sql`delete from users where email like '%@test.medtopix.invalid'`;
  const left = await sql`select (select count(*) from users where email like '%@test.medtopix.invalid')::int u, (select count(*) from api_keys where name = 'prueba')::int k, (select count(*) from patients where id_num like 'CC17%')::int p`;
  console.log('restos de prueba tras limpiar:', JSON.stringify(left[0]));
}
console.log(fails ? ('FALLARON ' + fails + ' de ' + n) : ('TODO OK · ' + n + ' pruebas'));
