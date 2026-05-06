create type notice_confidence as enum ('demo', 'auto', 'verified');

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  region text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school_id uuid references schools(id),
  department_id uuid references departments(id),
  majors text[] not null default '{}',
  notice_type text not null,
  year integer not null,
  deadline date,
  published_at date,
  source_name text not null,
  source_url text not null,
  summary text not null,
  tags text[] not null default '{}',
  confidence notice_confidence not null default 'auto',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_url, title)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  school_text text,
  major_text text,
  source_url text,
  details text,
  status text not null default 'pending',
  submitter_contact text,
  created_at timestamptz not null default now()
);

create table experiences (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school_id uuid references schools(id),
  department_id uuid references departments(id),
  majors text[] not null default '{}',
  year integer,
  content text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table market_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  external_url text,
  contact_hint text,
  expires_at date not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index notices_search_idx on notices using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || array_to_string(majors, ' '))
);

create index notices_deadline_idx on notices(deadline);
create index submissions_status_idx on submissions(status);
create index experiences_status_idx on experiences(status);
create index market_listings_status_idx on market_listings(status, expires_at);
