-- Functions/triggers for the EXISTING PhALGA schema provided by the client.
-- This migration intentionally does NOT create/alter base tables.

create extension if not exists pgcrypto;

-- Prevent ballot changes after submission
create or replace function public.reject_choice_change_if_ballot_submitted()
returns trigger
language plpgsql
as $$
declare
  v_is_submitted boolean;
begin
  select b.is_submitted into v_is_submitted
  from public.ballots b
  where b.id = coalesce(new.ballot_id, old.ballot_id);

  if coalesce(v_is_submitted, false) then
    raise exception 'Ballot is already submitted and immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists ballot_choices_immutable_after_submit on public.ballot_choices;
create trigger ballot_choices_immutable_after_submit
before insert or update or delete on public.ballot_choices
for each row execute function public.reject_choice_change_if_ballot_submitted();

-- Claim a voting session using queue_number + 6-digit token.
-- Marks session as "voting", sets voted_via + session_start, and unassigns tablet if phone login.
create or replace function public.claim_session(
  p_queue_number integer,
  p_token text,
  p_voted_via text default 'phone'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_tablet_id bigint;
begin
  if p_queue_number is null or p_queue_number <= 0 then
    raise exception 'invalid queue number';
  end if;
  if p_token is null or length(trim(p_token)) <> 6 then
    raise exception 'invalid token';
  end if;
  if p_voted_via not in ('tablet','phone') then
    raise exception 'invalid voted_via';
  end if;

  select vs.id, vs.tablet_id
    into v_session_id, v_tablet_id
  from public.voting_sessions vs
  where vs.queue_number = p_queue_number
    and vs.token::text = trim(p_token)
    and vs.status = 'queued'
  limit 1;

  if v_session_id is null then
    raise exception 'invalid queue/token or session not queued';
  end if;

  update public.voting_sessions
  set status = 'voting',
      voted_via = p_voted_via,
      session_start = coalesce(session_start, now()),
      tablet_id = case when p_voted_via = 'phone' then null else tablet_id end
  where id = v_session_id;

  -- If voter switches to phone, free the tablet immediately.
  if p_voted_via = 'phone' and v_tablet_id is not null then
    update public.tablets
    set status = 'vacant',
        current_session = null,
        last_active_at = now()
    where id = v_tablet_id;
  end if;

  return v_session_id;
end;
$$;

revoke all on function public.claim_session(integer, text, text) from public;
grant execute on function public.claim_session(integer, text, text) to anon, authenticated;

-- Submit ballot choices and lock ballot.
-- p_choices format: [{ "geo_group_id": 1, "candidate_ids": ["uuid","uuid"] }, ...]
create or replace function public.submit_ballot(p_session_id uuid, p_choices jsonb)
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
  if p_session_id is null then
    raise exception 'missing session';
  end if;

  select b.id, b.is_submitted
    into v_ballot_id, v_is_submitted
  from public.ballots b
  where b.session_id = p_session_id;

  if v_ballot_id is null then
    raise exception 'ballot not found for session';
  end if;
  if coalesce(v_is_submitted, false) then
    raise exception 'ballot already submitted';
  end if;

  -- reset choices (still allowed until we mark submitted)
  delete from public.ballot_choices where ballot_id = v_ballot_id;

  for v_group in
    select
      (x->>'geo_group_id')::bigint as geo_group_id,
      x->'candidate_ids' as candidate_ids
    from jsonb_array_elements(coalesce(p_choices, '[]'::jsonb)) as x
  loop
    select gg.max_votes into v_max_votes
    from public.geo_groups gg
    where gg.id = v_group.geo_group_id and gg.is_active = true;

    if v_max_votes is null then
      raise exception 'invalid geo group';
    end if;

    if jsonb_typeof(v_group.candidate_ids) <> 'array' then
      raise exception 'candidate_ids must be an array';
    end if;

    if jsonb_array_length(v_group.candidate_ids) > v_max_votes then
      raise exception 'max votes exceeded for geo group %', v_group.geo_group_id;
    end if;

    for v_candidate_id in
      select (value::text)::uuid
      from jsonb_array_elements_text(v_group.candidate_ids)
    loop
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

  update public.ballots
  set is_submitted = true,
      submitted_at = now()
  where id = v_ballot_id;

  update public.voting_sessions
  set status = 'voted',
      session_end = now()
  where id = p_session_id;
end;
$$;

revoke all on function public.submit_ballot(uuid, jsonb) from public;
grant execute on function public.submit_ballot(uuid, jsonb) to anon, authenticated;

