import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Quién firma los tokens de identidad y para quién deben venir emitidos.
const PROVIDERS = {
  google: { issuer: ['https://accounts.google.com', 'accounts.google.com'], jwks: 'https://www.googleapis.com/oauth2/v3/certs', audience: function () { return process.env.GOOGLE_CLIENT_ID; } },
  apple: { issuer: ['https://appleid.apple.com'], jwks: 'https://appleid.apple.com/auth/keys', audience: function () { return process.env.APPLE_CLIENT_ID; } }
};
const keySets = {};

export function socialConfig() {
  return { google: process.env.GOOGLE_CLIENT_ID || null, apple: process.env.APPLE_CLIENT_ID || null };
}

// Solo para las pruebas automatizadas: permite verificar contra un juego de llaves local en vez del proveedor real.
export function useKeySet(provider, keySet) { keySets[provider] = keySet; }

// Verifica firma, emisor, destinatario y vigencia del token. Devuelve la identidad o lanza un error.
export async function verifyIdToken(provider, token) {
  const p = PROVIDERS[provider];
  if (!p || !p.audience()) throw new Error('Proveedor no configurado.');
  if (!keySets[provider]) keySets[provider] = createRemoteJWKSet(new URL(p.jwks));
  const { payload } = await jwtVerify(String(token || ''), keySets[provider], { issuer: p.issuer, audience: p.audience() });
  const verified = payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.sub || !payload.email || !verified) throw new Error('El proveedor no entregó un correo verificado.');
  return { provider, sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: payload.name ? String(payload.name) : '' };
}

// Entre "ya sé quién es" y "aceptó los términos" la identidad viaja en un pase firmado por el servidor, de 30 minutos.
function mac(body) { return crypto.createHmac('sha256', process.env.SESSION_SECRET).update('social.' + body).digest('base64url'); }

export function signPending(identity) {
  const body = Buffer.from(JSON.stringify({ ...identity, exp: Date.now() + 30 * 60000 })).toString('base64url');
  return body + '.' + mac(body);
}

export function readPending(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const a = Buffer.from(mac(parts[0])), b = Buffer.from(parts[1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const v = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return v.exp > Date.now() ? v : null;
  } catch (e) { return null; }
}
