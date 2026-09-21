-- MedTopix · esquema de base de datos (Postgres / Neon)
-- Roles: profesional de la salud (médico, nutricionista, optómetra…), paciente y farmaceuta.

create table if not exists users (
  id            serial primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  role          text not null check (role in ('profesional','paciente','farmaceuta')),
  profession    text,
  specialty     text,
  doc_type      text,
  doc_num       text,
  phone         text,
  terms_accepted_at timestamptz,
  created_at    timestamptz not null default now()
);

-- Ficha del paciente. user_id se llena cuando el paciente tiene cuenta propia.
create table if not exists patients (
  id          serial primary key,
  user_id     integer unique references users(id) on delete set null,
  name        text not null,
  dob         date,
  id_num      text,
  diagnosis   text,
  specialty   text,
  phone       text,
  obs         text,
  link_code   text not null unique,
  created_by  integer references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Equipo tratante: profesionales y farmaceutas que siguen el caso.
create table if not exists care_team (
  patient_id  integer not null references patients(id) on delete cascade,
  user_id     integer not null references users(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (patient_id, user_id)
);
create index if not exists care_team_user_idx on care_team(user_id);

-- Tratamientos farmacológicos o nutricionales con su horario de recordatorio.
create table if not exists treatments (
  id          serial primary key,
  owner_id    integer not null references users(id) on delete cascade,
  patient_id  integer references patients(id) on delete cascade,
  kind        text not null default 'farmacologico' check (kind in ('farmacologico','nutricional')),
  name        text not null,
  specialty   text,
  dose        text,
  time        text not null,
  freq        text,
  maxdose     text,
  route       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists treatments_patient_idx on treatments(patient_id);
create index if not exists treatments_owner_idx on treatments(owner_id);

-- Registro diario de adherencia: yes = usó, late = otro horario, no = no usó.
create table if not exists adherence (
  id             serial primary key,
  treatment_id   integer not null references treatments(id) on delete cascade,
  patient_id     integer references patients(id) on delete cascade,
  date           date not null,
  status         text not null check (status in ('yes','late','no')),
  scheduled_time text,
  actual_time    text,
  med_name       text,
  recorded_by    integer references users(id) on delete set null,
  ts             bigint not null,
  unique (treatment_id, date)
);
create index if not exists adherence_patient_idx on adherence(patient_id, date);

-- Notas de seguimiento del caso por parte del equipo tratante.
create table if not exists case_notes (
  id          serial primary key,
  patient_id  integer not null references patients(id) on delete cascade,
  author_id   integer references users(id) on delete set null,
  note        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists case_notes_patient_idx on case_notes(patient_id, created_at desc);

-- ───────────── Evolución para el piloto (idempotente) ─────────────

-- Zona horaria del usuario: las horas de las dosis son hora local del paciente.
alter table users add column if not exists tz text;

-- Cuándo se avisa al equipo tratante si una dosis no se cumple:
-- always = cada dosis perdida · streak = dos seguidas · never = nunca.
alter table treatments add column if not exists escalate text not null default 'streak';
alter table treatments drop constraint if exists treatments_escalate_check;
alter table treatments add constraint treatments_escalate_check check (escalate in ('always','streak','never'));

-- Varias dosis por día: un registro por tratamiento, fecha y hora programada.
-- none = sin respuesta (lo marca el servidor cuando nadie confirma la dosis).
update adherence set scheduled_time = '' where scheduled_time is null;
alter table adherence alter column scheduled_time set default '';
alter table adherence alter column scheduled_time set not null;
alter table adherence drop constraint if exists adherence_treatment_id_date_key;
alter table adherence drop constraint if exists adherence_dose_key;
alter table adherence add constraint adherence_dose_key unique (treatment_id, date, scheduled_time);
alter table adherence drop constraint if exists adherence_status_check;
alter table adherence add constraint adherence_status_check check (status in ('yes','late','no','none'));

-- Dispositivos suscritos a notificaciones push (celular; el reloj replica las del celular).
create table if not exists push_subscriptions (
  id          serial primary key,
  user_id     integer not null references users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  ua          text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

-- Qué aviso ya se envió para cada dosis, para no repetirlo: remind1, remind2, missed.
create table if not exists dose_events (
  treatment_id   integer not null references treatments(id) on delete cascade,
  date           date not null,
  scheduled_time text not null,
  kind           text not null,
  sent_at        timestamptz not null default now(),
  primary key (treatment_id, date, scheduled_time, kind)
);

-- Bandeja de alertas del equipo tratante.
create table if not exists alerts (
  id           serial primary key,
  user_id      integer not null references users(id) on delete cascade,
  patient_id   integer not null references patients(id) on delete cascade,
  treatment_id integer references treatments(id) on delete set null,
  kind         text not null,
  message      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists alerts_user_idx on alerts(user_id, read_at, created_at desc);

-- Llaves de API para integrar una historia clínica electrónica. Solo se guarda el hash.
create table if not exists api_keys (
  id           serial primary key,
  user_id      integer not null references users(id) on delete cascade,
  name         text not null,
  prefix       text not null,
  key_hash     text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

-- Intentos fallidos de inicio de sesión, para frenar el tanteo de contraseñas.
create table if not exists login_attempts (
  email text not null,
  at    timestamptz not null default now()
);
create index if not exists login_attempts_idx on login_attempts(email, at);

-- Ingreso con Google o Apple: la cuenta se identifica por el `sub` del proveedor y puede no tener contraseña.
alter table users alter column password_hash drop not null;
alter table users add column if not exists google_sub text;
alter table users add column if not exists apple_sub text;
create unique index if not exists users_google_sub_idx on users(google_sub) where google_sub is not null;
create unique index if not exists users_apple_sub_idx on users(apple_sub) where apple_sub is not null;

-- Verificación de cuentas: profesionales y farmaceutas quedan pendientes hasta que un administrador los aprueba.
-- Los pacientes no necesitan aprobación. Los administradores se definen por correo en la variable ADMIN_EMAILS.
alter table users add column if not exists verified_at timestamptz;
alter table users add column if not exists verified_by integer references users(id) on delete set null;
update users set verified_at = created_at where role = 'paciente' and verified_at is null;

-- Foto de perfil: dirección de la foto de Google, o una imagen pequeña (256 px) subida por el usuario como data URL.
alter table users add column if not exists photo text;
