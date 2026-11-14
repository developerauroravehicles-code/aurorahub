-- AuroraField (mobile field app): location/photo proof for specialist jobs.
-- Additive only: no existing table, enum or policy is changed.

-- ---------------------------------------------------------------------------
-- 1. field_visits: one row per (demand, specialist); start proof on insert,
--    finish proof on completion.
-- ---------------------------------------------------------------------------
create table if not exists public.field_visits (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  specialist_id uuid not null references public.profiles(id) on delete restrict,

  -- Job address as geocoded on the device (null if geocoding failed)
  address_lat double precision check (address_lat between -90 and 90),
  address_lng double precision check (address_lng between -180 and 180),

  started_at timestamptz not null default now(),
  start_lat double precision not null check (start_lat between -90 and 90),
  start_lng double precision not null check (start_lng between -180 and 180),
  start_accuracy_m real,
  start_distance_m integer,
  start_suspicious boolean not null default false,
  start_reason text,

  -- Set atomically by the API before completing, to block double completion
  finish_claimed_at timestamptz,
  finished_at timestamptz,
  finish_lat double precision check (finish_lat between -90 and 90),
  finish_lng double precision check (finish_lng between -180 and 180),
  finish_accuracy_m real,
  finish_distance_m integer,
  finish_suspicious boolean,
  finish_reason text,

  photo_paths text[] not null default '{}',
  barcode_codes text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint field_visits_demand_specialist_key unique (demand_id, specialist_id),
  constraint field_visits_suspicious_start_has_reason
    check (not start_suspicious or coalesce(btrim(start_reason), '') <> ''),
  constraint field_visits_suspicious_finish_has_reason
    check (finish_suspicious is not true or coalesce(btrim(finish_reason), '') <> '')
);

create index if not exists field_visits_specialist_idx on public.field_visits (specialist_id, started_at desc);
create index if not exists field_visits_suspicious_idx on public.field_visits (started_at desc)
  where start_suspicious or finish_suspicious is true;

-- Proof integrity: timestamps come from the database clock, start proof can
-- never change after insert, and a finished visit is locked.
create or replace function public.field_visits_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.created_at := now();
    new.updated_at := now();
    new.finished_at := null;
    return new;
  end if;

  if old.finished_at is not null then
    raise exception 'field_visits %: finished visits cannot be changed', old.id;
  end if;

  new.id := old.id;
  new.demand_id := old.demand_id;
  new.specialist_id := old.specialist_id;
  new.created_at := old.created_at;
  new.started_at := old.started_at;
  new.address_lat := old.address_lat;
  new.address_lng := old.address_lng;
  new.start_lat := old.start_lat;
  new.start_lng := old.start_lng;
  new.start_accuracy_m := old.start_accuracy_m;
  new.start_distance_m := old.start_distance_m;
  new.start_suspicious := old.start_suspicious;
  new.start_reason := old.start_reason;
  if new.finished_at is not null then
    new.finished_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tr_field_visits_guard on public.field_visits;
create trigger tr_field_visits_guard
  before insert or update on public.field_visits
  for each row execute function public.field_visits_guard();

alter table public.field_visits enable row level security;

-- Writes happen only through the Hub field API (service role) after it has
-- verified the specialist and the assignment. Authenticated users get no
-- insert/update/delete policy, so proof cannot be written directly via REST.

-- Specialist: read own visits
drop policy if exists field_visits_specialist_select on public.field_visits;
create policy field_visits_specialist_select on public.field_visits
  for select to authenticated
  using (specialist_id = auth.uid());

-- Office: managers, finance and technical support can review all proof
drop policy if exists field_visits_office_select on public.field_visits;
create policy field_visits_office_select on public.field_visits
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('aurora_manager', 'general_manager', 'finance', 'technical_support')
    )
  );

-- ---------------------------------------------------------------------------
-- 2. field-photos: private bucket. Object path = <specialist_id>/<demand_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-photos', 'field-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists field_photos_specialist_insert on storage.objects;
create policy field_photos_specialist_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.demands d
      where d.id::text = (storage.foldername(name))[2]
        and d.assigned_specialist_id = auth.uid()
    )
  );

drop policy if exists field_photos_specialist_select on storage.objects;
create policy field_photos_specialist_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists field_photos_office_select on storage.objects;
create policy field_photos_office_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'field-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('aurora_manager', 'general_manager', 'finance', 'technical_support')
    )
  );
