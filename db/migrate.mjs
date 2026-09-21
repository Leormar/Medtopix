// Aplica db/schema.sql a la base de datos: node --env-file=.env.local db/migrate.mjs
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const statements = schema
  .split('\n').filter(function (l) { return !l.trim().startsWith('--'); }).join('\n')
  .split(';').map(function (s) { return s.trim(); }).filter(Boolean);

for (const st of statements) {
  await sql.query(st);
  console.log('ok  ' + st.split('\n')[0].slice(0, 70));
}
