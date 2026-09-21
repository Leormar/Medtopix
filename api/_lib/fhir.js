// Traducción entre las filas de MedTopix y recursos FHIR R4 para integrar una historia clínica electrónica.
export const BASE = 'https://medtopix.vercel.app';
export const SID_DOC = BASE + '/fhir/sid/documento';
export const SID_CASO = BASE + '/fhir/sid/codigo-caso';
export const CS_LOCAL = BASE + '/fhir/CodeSystem/medtopix';
export const EXT_HORA = BASE + '/fhir/StructureDefinition/hora-programada';
const DATA_ABSENT = 'http://terminology.hl7.org/CodeSystem/data-absent-reason';

// Las frecuencias que entiende la app, como intervalo en horas.
const FREQ_BY_HOURS = { 4: 'Cada 4 horas', 6: 'Cada 6 horas', 8: 'Cada 8 horas', 12: 'Cada 12 horas', 24: 'Una vez al día' };
const HOURS_BY_FREQ = { 'Cada 4 horas': 4, 'Cada 6 horas': 6, 'Cada 8 horas': 8, 'Cada 12 horas': 12, 'Una vez al día': 24 };
export const FREQS = Object.keys(HOURS_BY_FREQ).concat('Según necesidad');

export class FhirError extends Error {
  constructor(status, code, diagnostics) { super(diagnostics); this.status = status; this.code = code; }
}

export function outcome(code, diagnostics, severity) {
  return { resourceType: 'OperationOutcome', issue: [{ severity: severity || 'error', code: code, diagnostics: diagnostics }] };
}

export function bundle(base, type, query, resources) {
  return {
    resourceType: 'Bundle', type: 'searchset', total: resources.length,
    link: [{ relation: 'self', url: base + '/' + type + (query ? '?' + query : '') }],
    entry: resources.map(function (r) {
      return { fullUrl: base + '/' + r.resourceType + '/' + r.id, resource: r, search: { mode: 'match' } };
    })
  };
}

function meta(row) {
  return row.created_at ? { lastUpdated: new Date(row.created_at).toISOString() } : undefined;
}

// "Patient/12", "12" o una URL absoluta → 12. Cualquier otra cosa → null.
export function refId(value, type) {
  const m = new RegExp('(?:^|/)(?:' + type + '/)?(\\d{1,9})$').exec(String(value == null ? '' : value).trim());
  return m ? Number(m[1]) : null;
}

// "HH:MM" o "HH:MM:SS" → "HH:MM"; null si no es una hora válida.
export function hhmm(value) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(String(value == null ? '' : value).trim());
  return m ? m[1] + ':' + m[2] : null;
}

// Timing.repeat (o un texto tipo "cada 8 horas") → una de las frecuencias de la app. undefined si no se puede mapear.
export function freqFromTiming(timing, asNeeded, texts) {
  if (asNeeded === true) return 'Según necesidad';
  const r = (timing && timing.repeat) || {};
  if (r.period && r.periodUnit) {
    const unit = { h: 1, d: 24 }[r.periodUnit];
    const hours = unit ? (Number(r.period) * unit) / (Number(r.frequency) || 1) : NaN;
    return FREQ_BY_HOURS[hours];
  }
  // La dosis ("1 gota en cada ojo") solo cuenta si de verdad trae una frecuencia; un timing.code.text ilegible sí es un error.
  const codeText = String((timing && timing.code && timing.code.text) || '').toLowerCase();
  const text = [codeText].concat(texts || []).filter(Boolean).join(' ').toLowerCase();
  if (/seg[uú]n necesidad|\bprn\b/.test(text)) return 'Según necesidad';
  const each = /cada\s+(\d{1,2})\s*h/.exec(text);
  if (each) return FREQ_BY_HOURS[Number(each[1])];
  if (/una vez al d[ií]a|diari[oa]/.test(text)) return 'Una vez al día';
  if (codeText || (r.frequency && Number(r.frequency) !== 1)) return undefined;
  return 'Una vez al día';
}

function repeatOut(t) {
  const repeat = { timeOfDay: [t.time + ':00'] };
  const hours = HOURS_BY_FREQ[t.freq];
  if (hours === 24) { repeat.frequency = 1; repeat.period = 1; repeat.periodUnit = 'd'; }
  else if (hours) { repeat.frequency = 1; repeat.period = hours; repeat.periodUnit = 'h'; }
  return repeat;
}

export function patientOut(p) {
  const identifier = [];
  if (p.id_num) identifier.push({ use: 'official', system: SID_DOC, value: p.id_num });
  identifier.push({ use: 'secondary', system: SID_CASO, value: p.link_code });
  const out = { resourceType: 'Patient', id: String(p.id), meta: meta(p), identifier: identifier, active: true, name: [{ use: 'official', text: p.name }] };
  if (p.phone) out.telecom = [{ system: 'phone', value: p.phone }];
  if (p.dob) out.birthDate = p.dob;
  return out;
}

export function medicationRequestOut(t) {
  const dosage = { timing: { repeat: repeatOut(t) } };
  if (t.freq) dosage.timing.code = { text: t.freq };
  if (t.dose) dosage.text = t.dose;
  if (t.freq === 'Según necesidad') dosage.asNeededBoolean = true;
  if (t.route) dosage.route = { text: t.route };
  if (t.maxdose) dosage.additionalInstruction = [{ text: 'Dosis máxima diaria: ' + t.maxdose }];
  const out = {
    resourceType: 'MedicationRequest', id: String(t.id), meta: meta(t), status: 'active', intent: 'order',
    medicationCodeableConcept: { text: t.name }, subject: { reference: 'Patient/' + t.patient_id },
    authoredOn: meta(t) && meta(t).lastUpdated, dosageInstruction: [dosage]
  };
  if (t.notes) out.note = [{ text: t.notes }];
  return out;
}

export function nutritionOrderOut(t) {
  const schedule = { repeat: repeatOut(t) };
  if (t.freq) schedule.code = { text: t.freq };
  const out = {
    resourceType: 'NutritionOrder', id: String(t.id), meta: meta(t), status: 'active', intent: 'order',
    patient: { reference: 'Patient/' + t.patient_id }, dateTime: meta(t) && meta(t).lastUpdated,
    oralDiet: { schedule: [schedule], instruction: t.name }
  };
  if (t.notes) out.note = [{ text: t.notes }];
  return out;
}

// Desplazamiento UTC de una zona IANA en una fecha dada, p. ej. "-05:00". Sin zona conocida se asume Colombia.
function offsetFor(tz, date) {
  if (tz) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
        .formatToParts(new Date(date + 'T12:00:00Z')).find(function (x) { return x.type === 'timeZoneName'; });
      const m = /GMT([+-]\d{2}:\d{2})?/.exec(part ? part.value : '');
      if (m) return m[1] || '+00:00';
    } catch (e) { /* zona desconocida: se usa el valor por defecto */ }
  }
  return '-05:00';
}

const NOT_DONE = { no: 'El paciente reporta que no la usó', none: 'Sin respuesta del paciente' };

// a: fila de adherence con date como 'YYYY-MM-DD', más treatment_name y tz del paciente.
export function medicationAdministrationOut(a) {
  const done = a.status === 'yes' || a.status === 'late';
  const time = hhmm(a.status === 'late' || a.status === 'yes' ? (a.actual_time || a.scheduled_time) : a.scheduled_time);
  const out = {
    resourceType: 'MedicationAdministration', id: String(a.id),
    meta: a.ts ? { lastUpdated: new Date(Number(a.ts)).toISOString() } : undefined,
    status: done ? 'completed' : 'not-done',
    medicationCodeableConcept: { text: a.med_name || a.treatment_name },
    subject: { reference: 'Patient/' + a.patient_id },
    effectiveDateTime: time ? a.date + 'T' + time + ':00' + offsetFor(a.tz, a.date) : a.date,
    request: { reference: 'MedicationRequest/' + a.treatment_id }
  };
  if (!done) out.statusReason = [{ text: NOT_DONE[a.status] }];
  if (hhmm(a.scheduled_time)) out.extension = [{ url: EXT_HORA, valueTime: hhmm(a.scheduled_time) + ':00' }];
  if (a.status === 'late') out.note = [{ text: 'Aplicada en otro horario (programada para las ' + (a.scheduled_time || '—') + ').' }];
  return out;
}

// t: tratamiento con los conteos yes/late/no/none de los últimos 30 días.
export function adherenceObservationOut(t, period) {
  const n = { yes: Number(t.yes), late: Number(t.late), no: Number(t.no), none: Number(t.none) };
  const total = n.yes + n.late + n.no + n.none;
  const labels = { yes: 'Usó la medicación', late: 'La aplicó en otro horario', no: 'No la usó', none: 'Sin respuesta' };
  const out = {
    resourceType: 'Observation', id: 'adh-' + t.id, status: 'final',
    code: { coding: [{ system: CS_LOCAL, code: 'adherence-30d', display: 'Adherencia al tratamiento, últimos 30 días' }], text: 'Adherencia a ' + t.name + ' (30 días)' },
    subject: { reference: 'Patient/' + t.patient_id },
    focus: [{ reference: (t.kind === 'nutricional' ? 'NutritionOrder/' : 'MedicationRequest/') + t.id }],
    effectivePeriod: period,
    component: Object.keys(n).map(function (k) {
      return { code: { coding: [{ system: CS_LOCAL, code: 'adherence-count-' + k, display: labels[k] }] }, valueInteger: n[k] };
    })
  };
  if (total) out.valueQuantity = { value: Math.round(((n.yes + n.late) / total) * 1000) / 10, unit: '%', system: 'http://unitsofmeasure.org', code: '%' };
  else out.dataAbsentReason = { coding: [{ system: DATA_ABSENT, code: 'unknown' }], text: 'Sin registros de adherencia en el periodo.' };
  return out;
}

export function capabilityStatement(base) {
  const res = function (type, interactions, params, doc) {
    return {
      type: type, documentation: doc,
      interaction: interactions.map(function (code) { return { code: code }; }),
      searchParam: params.map(function (p) { return { name: p[0], type: p[1], documentation: p[2] }; })
    };
  };
  return {
    resourceType: 'CapabilityStatement', status: 'draft', experimental: true, date: '2026-09-20', kind: 'instance',
    publisher: 'MedTopix · proyecto académico', fhirVersion: '4.0.1', format: ['application/fhir+json', 'json'],
    software: { name: 'MedTopix', version: 'piloto' }, implementation: { description: 'Fachada FHIR de MedTopix para historia clínica electrónica', url: base },
    rest: [{
      mode: 'server',
      documentation: 'Subconjunto de FHIR R4. Prototipo académico no validado ni certificado. Texto libre, sin terminologías estándar. Las peticiones POST deben enviarse con Content-Type: application/json; las respuestas son application/fhir+json.',
      security: { description: 'Llave de API revocable en la cabecera Authorization: Bearer mtx_… La llave ve exactamente los casos que ve el usuario que la emitió. Sin SMART on FHIR ni OAuth2.' },
      resource: [
        res('Patient', ['read', 'search-type', 'create'], [['identifier', 'token', 'Número de documento o código del caso'], ['name', 'string', 'Parte del nombre']], 'Ficha del paciente. Crear es idempotente por número de documento.'),
        res('MedicationRequest', ['read', 'search-type', 'create'], [['patient', 'reference', 'Paciente']], 'Tratamiento farmacológico con su hora de recordatorio.'),
        res('NutritionOrder', ['read', 'search-type', 'create'], [['patient', 'reference', 'Paciente']], 'Tratamiento nutricional con su hora de recordatorio.'),
        res('MedicationAdministration', ['read', 'search-type'], [['patient', 'reference', 'Paciente'], ['request', 'reference', 'MedicationRequest de origen'], ['effective-time', 'date', 'Fecha de la dosis; admite los prefijos ge, gt, le, lt y eq']], 'Cada dosis registrada por el paciente o marcada sin respuesta por el servidor. Solo lectura.'),
        res('Observation', ['read', 'search-type'], [['patient', 'reference', 'Paciente'], ['code', 'token', 'adherence-30d']], 'Porcentaje de adherencia de los últimos 30 días por tratamiento. Solo lectura.')
      ]
    }]
  };
}
