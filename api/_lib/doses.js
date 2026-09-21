// Horario de dosis. La misma regla vive en app.html (doseTimes): si cambia aquí, cambia allá.
const EVERY = { 'Cada 4 horas': 4, 'Cada 6 horas': 6, 'Cada 8 horas': 8, 'Cada 12 horas': 12, 'Una vez al día': 24 };

// Horas del día ('HH:MM') en que toca el tratamiento. "Según necesidad" no tiene horario: no genera avisos.
export function doseTimes(time, freq) {
  const every = EVERY[freq];
  const m = /^(\d{2}):(\d{2})$/.exec(String(time || ''));
  if (!every || !m) return [];
  const start = Number(m[1]) * 60 + Number(m[2]);
  const out = [];
  for (let k = 0; k < 24 / every; k++) {
    const t = (start + k * every * 60) % 1440;
    out.push(String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  }
  return out.sort();
}

// Fecha y minuto del día en la zona horaria del usuario, más la fecha de ayer (dosis que cruzan la medianoche).
export function localClock(tz, now) {
  let zone = tz || 'America/Bogota';
  let parts;
  try { parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); }
  catch (e) { zone = 'America/Bogota'; return localClock(zone, now); }
  const v = {}; parts.forEach(function (p) { v[p.type] = p.value; });
  const date = v.year + '-' + v.month + '-' + v.day;
  const y = new Date(Date.UTC(Number(v.year), Number(v.month) - 1, Number(v.day)) - 86400000);
  return { date, minute: Number(v.hour) * 60 + Number(v.minute), yesterday: y.toISOString().slice(0, 10) };
}

export function toMinute(hhmm) { return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)); }
