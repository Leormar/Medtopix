import { sql, newLinkCode } from './_lib/db.js';
import { handler, requireApiKey } from './_lib/auth.js';
import { clean } from './_lib/shape.js';
import {
  BASE, SID_CASO, FREQS, FhirError, outcome, bundle, refId, hhmm, freqFromTiming, capabilityStatement,
  patientOut, medicationRequestOut, nutritionOrderOut, medicationAdministrationOut, adherenceObservationOut
} from './_lib/fhir.js';

// Fachada FHIR R4 para historias clínicas electrónicas. Llega como /api/fhir/<Tipo>[/<id>] (rewrite → ?path=).
// La llave de API ve exactamente los casos que ve el usuario que la emitió.

const KIND = { MedicationRequest: 'farmacologico', NutritionOrder: 'nutricional' };
const WRITABLE = ['Patient', 'MedicationRequest', 'NutritionOrder'];
const TYPES = WRITABLE.concat('MedicationAdministration', 'Observation');

function reply(res, status, body, headers) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
  Object.keys(headers || {}).forEach(function (k) { res.setHeader(k, headers[k]); });
  res.end(JSON.stringify(body));
}

// Vercel solo interpreta application/json. Con application/fhir+json entrega body undefined y, según el entorno,
// el flujo ya viene consumido: en ese caso se pide reenviar como application/json en vez de fallar a ciegas.
async function readBody(req) {
  let body;
  try { body = req.body; } catch (e) { throw new FhirError(400, 'invalid', 'El cuerpo no es JSON válido.'); }
  if (body === undefined && typeof req.on === 'function') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
    if (!body.length && Number(req.headers['content-length']) > 0) {
      throw new FhirError(415, 'not-supported', 'Envíe el recurso con la cabecera Content-Type: application/json (el contenido sigue siendo FHIR JSON).');
    }
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { throw new FhirError(400, 'invalid', 'El cuerpo no es JSON válido.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new FhirError(400, 'invalid', 'Se esperaba un recurso FHIR en JSON.');
  return body;
}

function one(v) { return Array.isArray(v) ? v[0] : v; }
function many(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

// Pacientes que ve el dueño de la llave: los que creó, su propia ficha o los casos donde está en el equipo tratante.
async function accessiblePatients(u, filter) {
  const f = filter || {};
  return sql`
    select p.id, p.user_id, p.name, to_char(p.dob, 'YYYY-MM-DD') as dob, p.id_num, p.phone, p.link_code, p.created_by, p.created_at
    from patients p
    where (p.created_by = ${u.id} or p.user_id = ${u.id}
           or exists (select 1 from care_team c where c.patient_id = p.id and c.user_id = ${u.id}))
      and (${f.id || null}::int is null or p.id = ${f.id || null})
      and (${f.identifier || null}::text is null or p.id_num = ${f.identifier || null} or p.link_code = upper(${f.identifier || null}))
      and (${f.name || null}::text is null or p.name ilike ${'%' + (f.name || '') + '%'})
    order by p.created_at desc limit 1000`;
}

async function patientIds(u, query) {
  const raw = one(query.patient) || one(query.subject);
  if (raw === undefined) return (await accessiblePatients(u)).map(function (p) { return p.id; });
  const id = refId(raw, 'Patient');
  if (!id) throw new FhirError(400, 'value', 'El parámetro patient debe ser un id o una referencia Patient/<id>.');
  return (await accessiblePatients(u, { id: id })).map(function (p) { return p.id; });
}

function requireWriter(u) {
  if (u.role !== 'profesional') throw new FhirError(403, 'forbidden', 'Solo la llave de un profesional de la salud puede crear recursos; esta llave es de solo lectura.');
}

function checkType(body, type) {
  if (body.resourceType !== type) throw new FhirError(400, 'invalid', 'resourceType debe ser ' + type + '.');
}

async function createPatient(u, body, base) {
  requireWriter(u); checkType(body, 'Patient');
  const n = many(body.name)[0] || {};
  const name = clean(n.text || many(n.given).concat(n.family || []).join(' '), 120);
  if (!name) throw new FhirError(400, 'required', 'Falta el nombre del paciente (name[0].text, o given y family).');
  const dob = body.birthDate === undefined ? null : String(body.birthDate);
  if (dob !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(Date.parse(dob)))) throw new FhirError(400, 'value', 'birthDate debe tener la forma AAAA-MM-DD.');
  const doc = many(body.identifier).find(function (i) { return i && i.value && i.system !== SID_CASO; });
  const idNum = clean(doc && doc.value, 40);
  const tel = many(body.telecom).find(function (t) { return t && t.value && (!t.system || t.system === 'phone'); });

  // Reenviar el mismo paciente no debe duplicar la ficha.
  if (idNum) {
    const found = await accessiblePatients(u, { identifier: idNum });
    if (found.length) return { status: 200, resource: patientOut(found[0]) };
  }
  const rows = await sql`
    insert into patients (name, dob, id_num, phone, link_code, created_by)
    values (${name}, ${dob}, ${idNum}, ${clean(tel && tel.value, 40)}, ${newLinkCode()}, ${u.id})
    returning id`;
  const created = await accessiblePatients(u, { id: rows[0].id });
  return { status: 201, resource: patientOut(created[0]), location: base + '/Patient/' + rows[0].id };
}

async function createTreatment(u, body, type, base) {
  requireWriter(u); checkType(body, type);
  const isMed = type === 'MedicationRequest';
  const subject = isMed ? body.subject : body.patient;
  const patientId = refId(subject && subject.reference, 'Patient');
  if (!patientId) throw new FhirError(400, 'required', 'Falta el paciente (' + (isMed ? 'subject' : 'patient') + '.reference = "Patient/<id>").');
  if (!(await accessiblePatients(u, { id: patientId })).length) throw new FhirError(404, 'not-found', 'Paciente no encontrado.');

  const note = many(body.note)[0];
  let name, dose = null, route = null, timing, asNeeded, texts = [], notes = clean(note && note.text, 1000);
  if (isMed) {
    const d = many(body.dosageInstruction)[0] || {};
    name = clean(body.medicationCodeableConcept && (body.medicationCodeableConcept.text || (many(body.medicationCodeableConcept.coding)[0] || {}).display), 160);
    dose = clean(d.text, 160); route = clean(d.route && d.route.text, 60);
    timing = d.timing; asNeeded = d.asNeededBoolean; texts = [d.text];
    if (!notes) notes = clean(d.patientInstruction, 1000);
  } else {
    const diet = body.oralDiet || {};
    name = clean(diet.instruction, 160);
    if (!name) { name = clean(note && note.text, 160); notes = null; }
    timing = many(diet.schedule)[0];
  }
  if (!name) throw new FhirError(400, 'required', isMed ? 'Falta el medicamento (medicationCodeableConcept.text).' : 'Falta la indicación nutricional (oralDiet.instruction o note[0].text).');
  const time = hhmm(many(timing && timing.repeat && timing.repeat.timeOfDay)[0]);
  if (!time) throw new FhirError(400, 'required', 'Falta la hora del recordatorio (' + (isMed ? 'dosageInstruction[0].timing' : 'oralDiet.schedule[0]') + '.repeat.timeOfDay[0] = "HH:MM:SS").');
  const freq = freqFromTiming(timing, asNeeded, texts);
  if (!freq) throw new FhirError(400, 'not-supported', 'Frecuencia no soportada. MedTopix admite: ' + FREQS.join(', ') + '.');

  const rows = await sql`
    insert into treatments (owner_id, patient_id, kind, name, specialty, dose, time, freq, route, notes)
    values (${u.id}, ${patientId}, ${KIND[type]}, ${name}, 'General', ${dose}, ${time}, ${freq}, ${route}, ${notes})
    returning *`;
  return { status: 201, resource: (isMed ? medicationRequestOut : nutritionOrderOut)(rows[0]), location: base + '/' + type + '/' + rows[0].id };
}

async function treatments(u, type, filter) {
  const ids = filter.id ? (await accessiblePatients(u)).map(function (p) { return p.id; }) : filter.patients;
  const rows = await sql`
    select * from treatments
    where kind = ${KIND[type]} and patient_id = any(${ids})
      and (${filter.id || null}::int is null or id = ${filter.id || null})
    order by created_at desc limit 1000`;
  return rows.map(type === 'MedicationRequest' ? medicationRequestOut : nutritionOrderOut);
}

// effective-time=ge2026-09-01 (repetible). Solo se compara la fecha, que es la fecha local del paciente.
function dateRange(query) {
  const range = { from: null, to: null };
  many(query['effective-time']).concat(many(query.date)).forEach(function (raw) {
    const m = /^(eq|ge|gt|le|lt)?(\d{4}-\d{2}-\d{2})/.exec(String(raw));
    if (!m) throw new FhirError(400, 'value', 'effective-time debe ser una fecha AAAA-MM-DD con prefijo opcional ge, gt, le, lt o eq.');
    const day = new Date(m[2] + 'T00:00:00Z'), op = m[1] || 'eq';
    if (op === 'gt') day.setUTCDate(day.getUTCDate() + 1);
    if (op === 'lt') day.setUTCDate(day.getUTCDate() - 1);
    const d = day.toISOString().slice(0, 10);
    if (op === 'eq' || op === 'ge' || op === 'gt') range.from = d;
    if (op === 'eq' || op === 'le' || op === 'lt') range.to = d;
  });
  return range;
}

async function administrations(u, filter) {
  const ids = filter.id ? (await accessiblePatients(u)).map(function (p) { return p.id; }) : filter.patients;
  const r = filter.range || {};
  const rows = await sql`
    select a.id, a.treatment_id, t.patient_id, to_char(a.date, 'YYYY-MM-DD') as date, a.status, a.scheduled_time,
           a.actual_time, a.med_name, a.ts, t.name as treatment_name, pu.tz
    from adherence a
    join treatments t on t.id = a.treatment_id
    join patients p on p.id = t.patient_id
    left join users pu on pu.id = p.user_id
    where t.kind = 'farmacologico' and t.patient_id = any(${ids})
      and (${filter.id || null}::int is null or a.id = ${filter.id || null})
      and (${filter.request || null}::int is null or a.treatment_id = ${filter.request || null})
      and (${r.from || null}::date is null or a.date >= ${r.from || null}::date)
      and (${r.to || null}::date is null or a.date <= ${r.to || null}::date)
    order by a.date desc, a.scheduled_time desc limit 1000`;
  return rows.map(medicationAdministrationOut);
}

async function observations(u, filter) {
  const ids = filter.id ? (await accessiblePatients(u)).map(function (p) { return p.id; }) : filter.patients;
  const rows = await sql`
    select t.id, t.patient_id, t.kind, t.name,
           count(*) filter (where a.status = 'yes') as yes, count(*) filter (where a.status = 'late') as late,
           count(*) filter (where a.status = 'no') as no, count(*) filter (where a.status = 'none') as none,
           to_char(current_date - 29, 'YYYY-MM-DD') as start, to_char(current_date, 'YYYY-MM-DD') as "end"
    from treatments t
    left join adherence a on a.treatment_id = t.id and a.date >= current_date - 29
    where t.patient_id = any(${ids}) and (${filter.id || null}::int is null or t.id = ${filter.id || null})
    group by t.id order by t.created_at desc limit 1000`;
  return rows.map(function (t) { return adherenceObservationOut(t, { start: t.start, end: t.end }); });
}

async function route(req, res) {
  const base = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || BASE.slice(8)) + '/api/fhir';
  const parts = String(one(req.query.path) || '').split('/').filter(Boolean);
  const type = parts[0], rawId = parts[1];

  if (type === 'metadata' || !type) {
    if (req.method !== 'GET') throw new FhirError(405, 'not-supported', 'Solo GET.');
    return reply(res, 200, capabilityStatement(base));
  }
  if (!TYPES.includes(type) || parts.length > 2) throw new FhirError(404, 'not-found', 'Recurso no soportado. Tipos disponibles: ' + TYPES.join(', ') + '.');

  const u = await requireApiKey(req, res); if (!u) return;

  if (req.method === 'POST') {
    if (rawId || !WRITABLE.includes(type)) throw new FhirError(405, 'not-supported', type + ' es de solo lectura o no admite POST sobre un id.');
    const body = await readBody(req);
    const out = type === 'Patient' ? await createPatient(u, body, base) : await createTreatment(u, body, type, base);
    return reply(res, out.status, out.resource, out.location ? { Location: out.location } : {});
  }
  if (req.method !== 'GET') throw new FhirError(405, 'not-supported', 'Método no soportado. Esta API admite GET y POST.');

  if (rawId) {
    const id = type === 'Observation' ? refId(String(rawId).replace(/^adh-/, ''), 'Observation') : refId(rawId, type);
    const found = !id ? []
      : type === 'Patient' ? (await accessiblePatients(u, { id: id })).map(patientOut)
      : type === 'MedicationAdministration' ? await administrations(u, { id: id })
      : type === 'Observation' ? await observations(u, { id: id })
      : await treatments(u, type, { id: id });
    // Mismo 404 si no existe que si es de otro profesional: no se revela la existencia.
    if (!found.length) throw new FhirError(404, 'not-found', type + '/' + rawId + ' no encontrado.');
    return reply(res, 200, found[0]);
  }

  const q = req.query;
  let list;
  if (type === 'Patient') {
    const ident = one(q.identifier);
    list = (await accessiblePatients(u, {
      id: q._id ? refId(one(q._id), 'Patient') || -1 : null,
      identifier: ident ? String(ident).split('|').pop() : null, name: one(q.name) || null
    })).map(patientOut);
  } else {
    const patients = await patientIds(u, q);
    if (type === 'MedicationAdministration') {
      const request = q.request ? refId(one(q.request), 'MedicationRequest') || -1 : null;
      list = await administrations(u, { patients: patients, request: request, range: dateRange(q) });
    } else if (type === 'Observation') {
      const code = String(one(q.code) || 'adherence').split('|').pop();
      list = ['adherence', 'adherence-30d'].includes(code) ? await observations(u, { patients: patients }) : [];
    } else list = await treatments(u, type, { patients: patients });
  }
  const self = Object.keys(q).filter(function (k) { return k !== 'path'; })
    .map(function (k) { return many(q[k]).map(function (v) { return encodeURIComponent(k) + '=' + encodeURIComponent(v); }).join('&'); }).join('&');
  reply(res, 200, bundle(base, type, self, list));
}

export default handler(async function (req, res) {
  try { await route(req, res); }
  catch (err) {
    if (!(err instanceof FhirError)) { console.error(err); }
    const known = err instanceof FhirError;
    reply(res, known ? err.status : 500, outcome(known ? err.code : 'exception', known ? err.message : 'Error interno del servidor.'));
  }
});
