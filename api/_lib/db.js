import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export const sql = neon(process.env.DATABASE_URL);

// Pacientes que el usuario puede ver: los que creó, su propia ficha o los casos donde está en el equipo tratante.
export async function canAccessPatient(userId, patientId) {
  const rows = await sql`
    select 1 from patients p
    where p.id = ${patientId}
      and (p.created_by = ${userId} or p.user_id = ${userId}
           or exists (select 1 from care_team c where c.patient_id = p.id and c.user_id = ${userId}))
    limit 1`;
  return rows.length > 0;
}

export function newLinkCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += abc[crypto.randomInt(abc.length)];
  return out.slice(0, 4) + '-' + out.slice(4);
}
