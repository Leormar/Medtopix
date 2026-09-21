// Ingreso con Google y Apple: se firma con llaves locales lo que firmarían los proveedores.
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
process.env.GOOGLE_CLIENT_ID = 'prueba-google.apps.googleusercontent.com';
process.env.APPLE_CLIENT_ID = 'app.medtopix.prueba';
const root = new URL('../api/', import.meta.url).pathname;
const auth = (await import(root + 'auth.js')).default;
const state = (await import(root + 'state.js')).default;
const patients = (await import(root + 'patients.js')).default;
const { sql } = await import(root + '_lib/db.js');
const { useKeySet } = await import(root + '_lib/social.js');

const good = await generateKeyPair('RS256'), evil = await generateKeyPair('RS256');
const jwk = Object.assign(await exportJWK(good.publicKey), { kid: 'k1', alg: 'RS256', use: 'sig' });
useKeySet('google', createLocalJWKSet({ keys: [jwk] })); useKeySet('apple', createLocalJWKSet({ keys: [jwk] }));
const ISS = { google: 'https://accounts.google.com', apple: 'https://appleid.apple.com' }, AUD = { google: process.env.GOOGLE_CLIENT_ID, apple: process.env.APPLE_CLIENT_ID };
function token(provider, claims, o) {
  o = o || {};
  return new SignJWT(Object.assign({ email_verified: true }, claims)).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(o.iss || ISS[provider]).setAudience(o.aud || AUD[provider]).setIssuedAt().setExpirationTime(o.exp || '10m').sign(o.key || good.privateKey);
}
async function call(h, method, query, body, cookie) {
  const out = { status: 200, headers: {} };
  const res = { headersSent: false, setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, status(c) { out.status = c; return res; }, json(j) { out.body = j; res.headersSent = true; return res; } };
  await h({ method, query: query || {}, body, headers: cookie ? { cookie } : {} }, res);
  const sc = out.headers['set-cookie']; out.cookie = sc ? sc.split(';')[0] : null; return out;
}
let fails = 0; const check = (l, c, x) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (c ? '' : '  -> ' + JSON.stringify(x))); };
const tag = Date.now(), mail = n => n + tag + '@test.medtopix.invalid';

let r = await call(auth, 'GET', { action: 'config' }); check('config expone los clientes configurados', r.body.google === AUD.google && r.body.apple === AUD.apple, r.body);

const g1 = { sub: 'g-' + tag, email: mail('ana'), name: 'Ana <b>Gmail</b>' };
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1) });
check('Google · persona nueva: pide perfil, no crea cuenta ni sesión', r.status === 200 && r.body.needsProfile && r.body.pending && !r.cookie, r);
check('aún no existe el usuario', (await sql`select 1 from users where email = ${g1.email}`).length === 0);
const pending = r.body.pending;
r = await call(auth, 'POST', { action: 'google' }, { pending, role: 'profesional', profession: 'medico', name: r.body.name });
check('sin aceptar términos -> 400', r.status === 400, r);
r = await call(auth, 'POST', { action: 'google' }, { pending, role: 'profesional', profession: 'medico', terms: true, name: g1.name, docnum: '123' });
check('completa perfil: cuenta creada con sesión', r.status === 201 && r.cookie && r.body.user.role === 'profesional', r); const doc = r.cookie;
let row = (await sql`select * from users where email = ${g1.email}`)[0];
check('queda sin contraseña, con google_sub y nombre saneado', row.password_hash === null && row.google_sub === g1.sub && !row.name.includes('<') && row.terms_accepted_at, row);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1) }); check('segunda vez: entra directo', r.status === 200 && r.cookie && !r.body.needsProfile, r);
r = await call(auth, 'POST', { action: 'login' }, { email: g1.email, password: '' }); check('cuenta sin contraseña no entra por correo', r.status === 400 || r.status === 401, r);
r = await call(auth, 'POST', { action: 'login' }, { email: g1.email, password: 'null' }); check('ni con contraseñas tramposas', r.status === 401, r);

r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1, { key: evil.privateKey }) }); check('firma de otra llave -> 401', r.status === 401 && !r.cookie, r);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1, { aud: 'otra-app' }) }); check('token emitido para otra app -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1, { iss: 'https://evil.example' }) }); check('emisor falso -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', g1, { exp: '-1m' }) }); check('token vencido -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', { sub: 'x', email: mail('nov'), email_verified: false }) }); check('correo sin verificar -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'apple' }, { credential: await token('google', g1) }); check('token de Google no sirve en Apple -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'google' }, { pending: pending.slice(0, -2) + 'xx', role: 'paciente', terms: true, name: 'X' }); check('pase alterado -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'apple' }, { pending, role: 'paciente', terms: true, name: 'X' }); check('pase de Google no sirve en Apple -> 401', r.status === 401, r);

await sql`update users set verified_at = now() where email = ${g1.email}`; // la doctora queda aprobada para poder crear una ficha más abajo

// foto de perfil
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', Object.assign({ picture: 'https://lh3.googleusercontent.com/a/ABC-def_123=s96-c' }, g1)) });
check('la foto de Google queda en el perfil', r.body.user.photo === 'https://lh3.googleusercontent.com/a/ABC-def_123=s96-c' && r.body.user.via === 'google', r.body.user);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', Object.assign({ picture: 'https://evil.example/x.png' }, g1)) });
check('una foto que no viene de Google se ignora', r.body.user.photo === 'https://lh3.googleusercontent.com/a/ABC-def_123=s96-c', r.body.user.photo);
r = await call(auth, 'POST', { action: 'photo' }, { photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }, doc); check('subir foto propia', r.status === 200 && r.body.user.photo.startsWith('data:image/jpeg'), r);
r = await call(auth, 'POST', { action: 'google' }, { credential: await token('google', Object.assign({ picture: 'https://lh3.googleusercontent.com/a/OTRA' }, g1)) });
check('la foto propia no la pisa la de Google', r.body.user.photo.startsWith('data:image/jpeg'), r.body.user.photo);
r = await call(auth, 'POST', { action: 'photo' }, { photo: 'data:text/html;base64,PHNjcmlwdD4=' }, doc); check('un archivo que no es imagen -> 400', r.status === 400, r);
r = await call(auth, 'POST', { action: 'photo' }, { photo: 'javascript:alert(1)' }, doc); check('una dirección tramposa -> 400', r.status === 400, r);
r = await call(auth, 'POST', { action: 'photo' }, { photo: 'data:image/jpeg;base64,' + 'A'.repeat(120000) }, doc); check('foto demasiado grande -> 400', r.status === 400, r);
r = await call(auth, 'POST', { action: 'photo' }, { photo: 'data:image/png;base64,AAAA' }); check('sin sesión -> 401', r.status === 401, r);
r = await call(auth, 'POST', { action: 'photo' }, { photo: null }, doc); check('quitar la foto', r.status === 200 && r.body.user.photo === null, r);

// vincular a una cuenta de correo existente
r = await call(auth, 'POST', { action: 'register' }, { email: mail('luis'), password: 'clave-segura-1', name: 'Luis Correo', role: 'farmaceuta', terms: true });
check('registro por correo sigue igual', r.status === 201, r);
r = await call(auth, 'POST', { action: 'apple' }, { credential: await token('apple', { sub: 'a-' + tag, email: mail('luis') }) });
check('Apple con el mismo correo: entra a la cuenta existente y avisa que se retiró la contraseña', r.status === 200 && r.cookie && r.body.user.role === 'farmaceuta' && r.body.passwordRemoved === true, r);
row = (await sql`select * from users where email = ${mail('luis')}`)[0];
check('la contraseña previa se invalida (pudo ponerla otro) y suma apple_sub', row.password_hash === null && row.apple_sub === 'a-' + tag, row);
r = await call(auth, 'POST', { action: 'login' }, { email: mail('luis'), password: 'clave-segura-1' }); check('la contraseña vieja ya no entra', r.status === 401, r);

// paciente nuevo por Apple con código del caso
r = await call(patients, 'POST', {}, { name: 'Paciente Social' }, doc); const code = r.body.patient.linkCode;
r = await call(auth, 'POST', { action: 'apple' }, { credential: await token('apple', { sub: 'a2-' + tag, email: mail('relay') }), name: 'Paciente Social' });
check('Apple · nuevo: usa el nombre que Apple entrega aparte', r.body.needsProfile && r.body.name === 'Paciente Social', r.body);
r = await call(auth, 'POST', { action: 'apple' }, { pending: r.body.pending, role: 'paciente', terms: true, name: 'Paciente Social', linkCode: code });
check('paciente por Apple toma la ficha de su profesional', r.status === 201, r);
r = await call(state, 'GET', {}, null, r.cookie); check('y ve su ficha', r.body.patients.length === 1 && r.body.patients[0].isSelf && r.body.patients[0].linkCode === code, r.body);

await sql`delete from patients where created_by in (select id from users where email like ${'%' + tag + '@test.medtopix.invalid'}) or user_id in (select id from users where email like ${'%' + tag + '@test.medtopix.invalid'})`;
await sql`delete from users where email like ${'%' + tag + '@test.medtopix.invalid'}`;
console.log(fails ? 'FALLARON ' + fails : 'TODO OK · ingreso social');
