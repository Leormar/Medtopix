// Verificación de cuentas: profesionales y farmaceutas esperan aprobación; el administrador se define por correo + Google/Apple.
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
const tag = Date.now(), mail = n => n + tag + '@test.medtopix.invalid';
process.env.GOOGLE_CLIENT_ID = 'prueba-google.apps.googleusercontent.com';
process.env.ADMIN_EMAILS = mail('admin') + ', ' + mail('admin2');
const root = new URL('../api/', import.meta.url).pathname;
const mods = {}; for (const m of ['auth', 'state', 'patients', 'treatments', 'notes', 'keys', 'admin', 'fhir']) mods[m] = (await import(root + m + '.js')).default;
const { sql } = await import(root + '_lib/db.js');
const { useKeySet } = await import(root + '_lib/social.js');
const kp = await generateKeyPair('RS256'); const jwk = Object.assign(await exportJWK(kp.publicKey), { kid: 'k1', alg: 'RS256', use: 'sig' });
useKeySet('google', createLocalJWKSet({ keys: [jwk] }));
const gtoken = c => new SignJWT(Object.assign({ email_verified: true }, c)).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('https://accounts.google.com').setAudience(process.env.GOOGLE_CLIENT_ID).setIssuedAt().setExpirationTime('10m').sign(kp.privateKey);
async function call(mod, method, query, body, cookie, headers) {
  const out = { status: 200, headers: {} };
  const res = { headersSent: false, setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, status(c) { out.status = c; return res; }, json(j) { out.body = j; res.headersSent = true; return res; }, send(j) { out.body = j; return res; }, end() { return res; } };
  await mods[mod]({ method, query: query || {}, body, headers: Object.assign(cookie ? { cookie } : {}, headers || {}) }, res);
  const sc = out.headers['set-cookie']; out.cookie = sc ? sc.split(';')[0] : null; return out;
}
let fails = 0; const check = (l, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c ? '' : '  -> ' + JSON.stringify(x))); };
const reg = o => call('auth', 'POST', { action: 'register' }, Object.assign({ password: 'clave-segura-1', terms: true }, o));

let r = await reg({ email: mail('pac'), name: 'Paciente', role: 'paciente' });
check('paciente: activo desde el registro', r.status === 201 && r.body.user.verified === true, r.body); const pac = r.cookie;
r = await call('state', 'GET', {}, null, pac); check('paciente ve su ficha sin esperar a nadie', !r.body.pending && r.body.patients.length === 1, r.body);

r = await reg({ email: mail('doc'), name: 'Dra Pendiente', role: 'profesional', profession: 'medico' });
check('profesional: se registra, pero queda pendiente', r.status === 201 && r.body.user.verified === false, r.body); const doc = r.cookie; const docId = r.body.user.id;
r = await call('state', 'GET', {}, null, doc); check('pendiente: entra, ve su estado y ningún dato', r.status === 200 && r.body.pending === true && r.body.patients.length === 0, r.body);
r = await call('patients', 'POST', {}, { name: 'X' }, doc); check('pendiente no crea fichas -> 403', r.status === 403 && r.body.pending, r);
const code = (await sql`select link_code from patients where user_id = (select id from users where email = ${mail('pac')})`)[0].link_code;
r = await call('patients', 'POST', { action: 'link' }, { code }, doc); check('pendiente no se vincula a un caso ni con el código -> 403', r.status === 403, r);
check('y no quedó en el equipo tratante', (await sql`select 1 from care_team where user_id = ${docId}`).length === 0);
r = await call('treatments', 'POST', {}, { name: 'X', time: '08:00' }, doc); check('pendiente no formula -> 403', r.status === 403, r);
r = await call('keys', 'POST', {}, { name: 'HCE' }, doc); check('pendiente no crea llaves de integración -> 403', r.status === 403, r);
r = await reg({ email: mail('far'), name: 'QF Pendiente', role: 'farmaceuta' }); check('farmaceuta: también pendiente', r.body.user.verified === false, r.body);

// administración
r = await reg({ email: mail('admin'), name: 'Falso Admin', role: 'profesional' }); check('correo de administración no se registra con contraseña', r.status === 400, r);
r = await call('admin', 'GET', {}, null, doc); check('un usuario cualquiera no ve la administración -> 404', r.status === 404, r);
r = await call('auth', 'POST', { action: 'google' }, { credential: await gtoken({ sub: 'adm-' + tag, email: mail('admin'), name: 'Admin Real' }) });
r = await call('auth', 'POST', { action: 'google' }, { pending: r.body.pending, role: 'profesional', profession: 'medico', terms: true, name: 'Admin Real' });
check('administrador entra con Google: verificado y con permisos', r.status === 201 && r.body.user.admin === true && r.body.user.verified === true, r.body); const adm = r.cookie;
await sql`insert into users (email, password_hash, name, role) values (${mail('admin2')}, 'x', 'Impostor', 'profesional')`;
const imp = (await sql`select * from users where email = ${mail('admin2')}`)[0];
const { isAdmin } = await import(root + '_lib/auth.js'); check('correo de admin SIN Google/Apple no es administrador', isAdmin(imp) === false, imp);

r = await call('admin', 'GET', {}, null, adm); check('admin ve 3 cuentas pendientes', r.status === 200 && r.body.pending === 3 && r.body.accounts.some(a => a.email === mail('doc')), r.body);
r = await call('admin', 'POST', {}, { id: docId, action: 'approve' }, adm); check('aprueba a la doctora', r.status === 200 && r.body.pending === 2, r.body);
r = await call('state', 'GET', {}, null, doc); check('ya aprobada: deja de estar pendiente', !r.body.pending && r.body.user.verified === true, r.body);
r = await call('patients', 'POST', { action: 'link' }, { code }, doc); check('y ahora sí se vincula al caso', r.status === 200, r);
r = await call('keys', 'POST', {}, { name: 'HCE' }, doc); const key = r.body.created; check('y crea su llave de integración', r.status === 201 && key, r);
r = await call('fhir', 'GET', { path: 'Patient' }, null, null, { authorization: 'Bearer ' + key }); check('la llave funciona', r.status === 200, r.status);
const pid = (await sql`select id from patients where link_code = ${code}`)[0].id;
r = await call('admin', 'POST', {}, { id: pid === -1 ? 0 : (await sql`select id from users where email = ${mail('pac')}`)[0].id, action: 'revoke' }, adm); check('a un paciente no se le retira nada -> 404', r.status === 404, r);
r = await call('admin', 'POST', {}, { id: docId, action: 'revoke' }, adm); check('retira la verificación', r.status === 200, r);
r = await call('notes', 'GET', { patientId: String(pid) }, null, doc); check('sin verificación pierde el acceso al caso -> 403', r.status === 403, r);
r = await call('fhir', 'GET', { path: 'Patient' }, null, null, { authorization: 'Bearer ' + key }); check('y su llave de integración deja de servir -> 401', r.status === 401, r.status);

const like = '%' + tag + '@test.medtopix.invalid';
await sql`delete from patients where created_by in (select id from users where email like ${like}) or user_id in (select id from users where email like ${like})`;
await sql`delete from users where email like ${like}`;
console.log(fails ? 'FALLARON ' + fails : 'TODO OK · verificación de cuentas');
