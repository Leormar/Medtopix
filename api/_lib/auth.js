import crypto from 'node:crypto';
import { sql } from './db.js';

const COOKIE = 'mt_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET no configurado');
  return s;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(parts[1], 'hex'), 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}

function unsign(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const mac = crypto.createHmac('sha256', secret()).update(parts[0]).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(parts[1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

export function setSession(res, userId) {
  const token = sign({ uid: userId, exp: Date.now() + MAX_AGE * 1000 });
  res.setHeader('Set-Cookie', COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

export function publicUser(u) {
  return {
    id: u.id, e: u.email, name: u.name, role: u.role, profession: u.profession,
    specialty: u.specialty, doctype: u.doc_type, docnum: u.doc_num, phone: u.phone, at: u.created_at
  };
}

// Devuelve el usuario de la sesión o responde 401 y devuelve null.
export async function requireUser(req, res) {
  const raw = (req.headers.cookie || '').split(';').map(function (c) { return c.trim(); })
    .find(function (c) { return c.startsWith(COOKIE + '='); });
  const payload = raw ? unsign(raw.slice(COOKIE.length + 1)) : null;
  if (payload) {
    const rows = await sql`select * from users where id = ${payload.uid}`;
    if (rows.length) return rows[0];
  }
  res.status(401).json({ error: 'Sesión no válida. Inicia sesión de nuevo.' });
  return null;
}

// Llaves de API para sistemas externos (historia clínica): "Authorization: Bearer mtx_…". Solo se guarda el hash.
export function newApiKey() {
  const key = 'mtx_' + crypto.randomBytes(24).toString('hex');
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

// Devuelve el usuario dueño de la llave (la integración ve exactamente los casos que él ve) o responde 401.
export async function requireApiKey(req, res) {
  const m = /^Bearer\s+(mtx_[a-f0-9]{48})$/.exec(req.headers.authorization || '');
  if (m) {
    const rows = await sql`
      select u.*, k.id as key_id from api_keys k join users u on u.id = k.user_id
      where k.key_hash = ${hashApiKey(m[1])} and k.revoked_at is null`;
    if (rows.length) {
      await sql`update api_keys set last_used_at = now() where id = ${rows[0].key_id}`;
      return rows[0];
    }
  }
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login', diagnostics: 'Llave de API ausente, inválida o revocada.' }] });
  return null;
}

// Envuelve un handler: responde JSON sin caché y convierte excepciones en 500.
export function handler(fn) {
  return async function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try { await fn(req, res); }
    catch (err) {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor.' });
    }
  };
}
