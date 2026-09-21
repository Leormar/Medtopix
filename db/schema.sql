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
