-- PhALGA Automated Online Voting System
-- Initial schema + RLS + safe public views

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tablet_status') then
    create type public.tablet_status as enum ('vacant', 'in_use', 'offline');
  end if;

  if not exists (select 1 from pg_type where typname = 'voting_session_status') then
    create type public.voting_session_status as enum (
      'queued',
      'assigned',
      'voting',
      'submitted',
      'cancelled',
      'expired'
    );
  end if;
end $$;

-- Core tables
create table if not exists public.voters (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text,
  address text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists voters_full_name_trgm_idx on public.voters using gin (full_name gin_trgm_ops);

create table if not exists public.geo_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  max_votes int not null default 3 check (max_votes between 1 and 10),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  geo_group_id uuid not null references public.geo_groups(id) on delete cascade,
  display_name text not null,
  ballot_name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists candidates_group_sort_unique on public.candidates (geo_group_id, sort_order, id);
create index if not exists candidates_geo_group_id_idx on public.candidates (geo_group_id);

create table if not exists public.tablets (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  status public.tablet_status not null default 'offline',
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tablets_status_idx on public.tablets (status);

create table if not exists public.voting_sessions (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.voters(id) on delete restrict,
  queue_number bigint not null,
  token_hash text not null,
  status public.voting_session_status not null default 'queued',
  assigned_tablet_id uuid references public.tablets(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint voting_sessions_queue_number_positive check (queue_number > 0)
);

-- One active session per voter (anything not terminal)
create unique index if not exists voting_sessions_one_active_per_voter
  on public.voting_sessions (voter_id)
  where status in ('queued', 'assigned', 'voting');

create index if not exists voting_sessions_status_queue_idx on public.voting_sessions (status, queue_number);
create index if not exists voting_sessions_assigned_tablet_idx on public.voting_sessions (assigned_tablet_id);

create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references public.voters(id) on delete restrict,
  voting_session_id uuid not null unique references public.voting_sessions(id) on delete restrict,
  is_submitted boolean not null default false,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ballots_submitted_fields check (
    (is_submitted = false and submitted_at is null)
    or (is_submitted = true and submitted_at is not null)
  )
);

create index if not exists ballots_voter_id_idx on public.ballots (voter_id);

create table if not exists public.ballot_choices (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  geo_group_id uuid not null references public.geo_groups(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint ballot_choices_unique_per_ballot_candidate unique (ballot_id, candidate_id)
);

create index if not exists ballot_choices_ballot_id_idx on public.ballot_choices (ballot_id);
create index if not exists ballot_choices_geo_group_idx on public.ballot_choices (geo_group_id);
create index if not exists ballot_choices_candidate_idx on public.ballot_choices (candidate_id);

-- Helper: role checks based on JWT app_metadata.role
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = role_name;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.has_role('admin') or public.has_role('comelec');
$$;

-- Trigger: prevent ballot changes after submission
create or replace function public.reject_if_ballot_submitted()
returns trigger
language plpgsql
as $$
declare
  submitted boolean;
begin
  select b.is_submitted into submitted
  from public.ballots b
  where b.id = coalesce(new.ballot_id, old.ballot_id);

  if submitted then
    raise exception 'Ballot is already submitted and immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists ballot_choices_immutable_after_submit on public.ballot_choices;
create trigger ballot_choices_immutable_after_submit
before insert or update or delete on public.ballot_choices
for each row execute function public.reject_if_ballot_submitted();

-- RPC: staff check-in creates/returns session + token (token returned only from RPC)
create or replace function public.check_in_voter(p_voter_id uuid)
returns table (
  voting_session_id uuid,
  queue_number bigint,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue bigint;
  v_token text;
  v_token_hash text;
  v_exp timestamptz;
  v_session_id uuid;
begin
  if not public.is_staff() then
    raise exception 'not authorized';
  end if;

  -- expire any prior active session for this voter (defensive; unique index should prevent duplicates)
  update public.voting_sessions
  set status = 'expired'
  where voter_id = p_voter_id
    and status in ('queued', 'assigned', 'voting');

  select coalesce(max(queue_number), 0) + 1 into v_queue
  from public.voting_sessions
  where created_at::date = now()::date;

  v_token := lpad(((floor(random() * 1000000))::int)::text, 6, '0');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_exp := now() + interval '30 minutes';

  insert into public.voting_sessions (
    voter_id, queue_number, token_hash, status, verified_by, verified_at, expires_at
  ) values (
    p_voter_id, v_queue, v_token_hash, 'queued', auth.uid(), now(), v_exp
  )
  returning id into v_session_id;

  insert into public.ballots (voter_id, voting_session_id)
  values (p_voter_id, v_session_id);

  voting_session_id := v_session_id;
  queue_number := v_queue;
  token := v_token;
  expires_at := v_exp;
  return next;
end;
$$;

revoke all on function public.check_in_voter(uuid) from public;
grant execute on function public.check_in_voter(uuid) to authenticated;

-- RPC: verify queue_number + token and start voting (used by tablet or voter phone)
create or replace function public.claim_session(p_queue_number bigint, p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_hash text;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select id into v_session_id
  from public.voting_sessions
  where queue_number = p_queue_number
    and token_hash = v_hash
    and status in ('queued', 'assigned')
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_session_id is null then
    raise exception 'invalid queue/token';
  end if;

  update public.voting_sessions
  set status = 'voting',
      assigned_tablet_id = null
  where id = v_session_id;

  return v_session_id;
end;
$$;

revoke all on function public.claim_session(bigint, text) from public;
grant execute on function public.claim_session(bigint, text) to anon, authenticated;

-- RPC: submit ballot with server-side max-votes enforcement + immutability
-- p_choices: [{ "geo_group_id": "...", "candidate_ids": ["...","..."] }, ...]
create or replace function public.submit_ballot(p_voting_session_id uuid, p_choices jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ballot_id uuid;
  v_is_submitted boolean;
  v_group record;
  v_max_votes int;
  v_candidate_id uuid;
begin
  select b.id, b.is_submitted into v_ballot_id, v_is_submitted
  from public.ballots b
  where b.voting_session_id = p_voting_session_id;

  if v_ballot_id is null then
    raise exception 'ballot not found';
  end if;

  if v_is_submitted then
    raise exception 'ballot already submitted';
  end if;

  -- clear existing (still allowed pre-submit)
  delete from public.ballot_choices where ballot_id = v_ballot_id;

  -- validate and insert
  for v_group in
    select
      (x->>'geo_group_id')::uuid as geo_group_id,
      x->'candidate_ids' as candidate_ids
    from jsonb_array_elements(p_choices) as x
  loop
    select max_votes into v_max_votes
    from public.geo_groups
    where id = v_group.geo_group_id and is_active = true;

    if v_max_votes is null then
      raise exception 'invalid geo group';
    end if;

    if jsonb_array_length(v_group.candidate_ids) > v_max_votes then
      raise exception 'max votes exceeded for geo group %', v_group.geo_group_id;
    end if;

    for v_candidate_id in
      select (value::text)::uuid
      from jsonb_array_elements_text(v_group.candidate_ids)
    loop
      -- ensure candidate belongs to group and active
      if not exists (
        select 1
        from public.candidates c
        where c.id = v_candidate_id
          and c.geo_group_id = v_group.geo_group_id
          and c.is_active = true
      ) then
        raise exception 'invalid candidate in geo group';
      end if;

      insert into public.ballot_choices (ballot_id, geo_group_id, candidate_id)
      values (v_ballot_id, v_group.geo_group_id, v_candidate_id);
    end loop;
  end loop;

  -- Mark submitted + lock
  update public.ballots
  set is_submitted = true,
      submitted_at = now()
  where id = v_ballot_id;

  update public.voting_sessions
  set status = 'submitted'
  where id = p_voting_session_id;
end;
$$;

revoke all on function public.submit_ballot(uuid, jsonb) from public;
grant execute on function public.submit_ballot(uuid, jsonb) to anon, authenticated;

-- RLS
alter table public.voters enable row level security;
alter table public.geo_groups enable row level security;
alter table public.candidates enable row level security;
alter table public.tablets enable row level security;
alter table public.voting_sessions enable row level security;
alter table public.ballots enable row level security;
alter table public.ballot_choices enable row level security;

-- Staff manage voters and setup entities
create policy "staff_select_voters" on public.voters
for select to authenticated
using (public.is_staff());

create policy "staff_manage_voters" on public.voters
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "staff_manage_geo_groups" on public.geo_groups
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "staff_manage_candidates" on public.candidates
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "staff_manage_tablets" on public.tablets
for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

create policy "staff_select_voting_sessions" on public.voting_sessions
for select to authenticated
using (public.is_staff());

-- Ballots/choices: staff can read for results; no direct writes (writes via RPC)
create policy "staff_select_ballots" on public.ballots
for select to authenticated
using (public.is_staff());

create policy "staff_select_ballot_choices" on public.ballot_choices
for select to authenticated
using (public.is_staff());

-- Public read access for active election configuration (safe tables)
create policy "public_read_active_geo_groups" on public.geo_groups
for select to anon, authenticated
using (is_active = true);

create policy "public_read_active_candidates" on public.candidates
for select to anon, authenticated
using (is_active = true);

-- Public RPCs for tablet/queue board + results (avoid exposing token_hash via table SELECT)
create or replace function public.get_public_tablet_board()
returns table (
  id uuid,
  label text,
  status public.tablet_status,
  last_seen_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.label, t.status, t.last_seen_at
  from public.tablets t;
$$;

create or replace function public.get_public_queue()
returns table (
  id uuid,
  queue_number bigint,
  status public.voting_session_status,
  assigned_tablet_id uuid,
  verified_at timestamptz,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.queue_number,
    s.status,
    s.assigned_tablet_id,
    s.verified_at,
    s.expires_at
  from public.voting_sessions s
  where s.status in ('queued','assigned','voting','submitted')
    and s.expires_at > now() - interval '2 hours';
$$;

create or replace function public.get_public_results_by_candidate()
returns table (
  candidate_id uuid,
  geo_group_id uuid,
  vote_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as candidate_id,
    c.geo_group_id,
    count(bc.id)::bigint as vote_count
  from public.candidates c
  left join public.ballot_choices bc on bc.candidate_id = c.id
  left join public.ballots b on b.id = bc.ballot_id and b.is_submitted = true
  where c.is_active = true
  group by c.id, c.geo_group_id;
$$;

revoke all on function public.get_public_tablet_board() from public;
revoke all on function public.get_public_queue() from public;
revoke all on function public.get_public_results_by_candidate() from public;
grant execute on function public.get_public_tablet_board() to anon, authenticated;
grant execute on function public.get_public_queue() to anon, authenticated;
grant execute on function public.get_public_results_by_candidate() to anon, authenticated;

