// La app pinta estos textos dentro de HTML; se neutralizan los caracteres que permitirían inyectar marcado.
const SAFE = { '<': '‹', '>': '›', '"': '”', "'": '’', '`': '’' };
export function clean(value, max) {
  const out = String(value == null ? '' : value).replace(/[<>"'`]/g, function (c) { return SAFE[c]; }).trim().slice(0, max || 500);
  return out || null;
}

// Convierte filas de la base de datos al formato que usa la app en el navegador.
export function patientOut(p, userId) {
  return {
    id: p.id, name: p.name, dob: p.dob || '', idNum: p.id_num || '', diagnosis: p.diagnosis || '',
    specialty: p.specialty || '', phone: p.phone || '', obs: p.obs || '', createdAt: p.created_at,
    linkCode: p.link_code, hasAccount: !!p.user_id, mine: p.created_by === userId, isSelf: p.user_id === userId
  };
}

export function treatmentOut(t, userId) {
  return {
    id: t.id, name: t.name, patientId: t.patient_id, kind: t.kind, specialty: t.specialty || '',
    dose: t.dose || '', time: t.time, freq: t.freq || '', maxdose: t.maxdose || '', route: t.route || '',
    notes: t.notes || '', createdAt: t.created_at, mine: t.owner_id === userId
  };
}

export function adherenceOut(a) {
  return {
    medId: a.treatment_id, patientId: a.patient_id, date: a.date, status: a.status,
    scheduledTime: a.scheduled_time, actualTime: a.actual_time, ts: Number(a.ts), medName: a.med_name
  };
}
