-- Unify backend schema (Supabase Postgres).
-- Run in Supabase Dashboard > SQL Editor.
-- The backend uses service_role (bypasses RLS). RLS is enabled with NO
-- public policies, so direct client access is denied by default.

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key, -- = auth.users.id (Supabase Auth)
  first_name text,
  email text,
  university text,
  faculty text,
  department text,
  level text,
  university_id uuid references universities(id),
  grad_target numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists courses (
  code text primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists weeks (
  course text not null references courses(code) on delete cascade,
  week int not null,
  title text not null default '',
  subtitle text not null default '',
  note_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (course, week)
);

create table if not exists topic_progress (
  user_id uuid not null,
  course text not null,
  week int not null,
  topic int not null,
  done boolean not null default true,
  completed_at timestamptz,
  primary key (user_id, course, week, topic)
);

create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount int not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists xp_events_user_created_idx on xp_events (user_id, created_at desc);

alter table universities enable row level security;
alter table profiles enable row level security;
alter table courses enable row level security;
alter table weeks enable row level security;
alter table topic_progress enable row level security;
alter table xp_events enable row level security;
