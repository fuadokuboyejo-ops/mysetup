-- Server-side enforcement of the monthly AI-generation cap.
--
-- Previously the 100/month limit was only checked in the app, and the counter
-- was incremented by the client AFTER a generation — both bypassable (call the
-- revamp function directly, or simply never increment). These functions move the
-- check + increment server-side and make them atomic, so the cap can't be
-- exceeded even under concurrent requests. The revamp Edge Function calls
-- consume_generation() before spending any Gemini quota, and refund_generation()
-- if the generation fails.

-- Atomically reserve one generation for the current user this month. Returns a
-- single row: allowed (was there room?), used_count (usage after this call), and
-- remaining. The limit is hardcoded here so the client can never raise it —
-- even if a user calls this RPC directly it only ever meters their own quota.
create or replace function public.consume_generation()
returns table (allowed boolean, used_count integer, remaining integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  gen_limit constant integer := 100;
  month_key text := to_char(current_date, 'YYYY-FMMM');
  used integer;
begin
  -- Lock this user's profile row so concurrent revamp calls serialize; two
  -- requests can't both read "99 used" and both slip past the cap.
  select case when generations_month = month_key then generations_count else 0 end
    into used
    from public.profiles
    where id = (select auth.uid())
    for update;

  if used is null then
    raise exception 'Profile not found for current user';
  end if;

  if used >= gen_limit then
    return query select false, used, 0;
    return;
  end if;

  update public.profiles
    set generations_count = used + 1,
        generations_month = month_key,
        updated_at = now()
    where id = (select auth.uid());

  return query select true, used + 1, gen_limit - (used + 1);
end;
$$;

grant execute on function public.consume_generation() to authenticated;

-- Give a generation back when downstream work (e.g. the Gemini call) fails, so a
-- user isn't charged a slot for an attempt that produced no image. No-op if the
-- month has already rolled over since the consume.
create or replace function public.refund_generation()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  month_key text := to_char(current_date, 'YYYY-FMMM');
  used integer;
begin
  update public.profiles
    set generations_count = greatest(generations_count - 1, 0),
        updated_at = now()
    where id = (select auth.uid()) and generations_month = month_key
    returning generations_count into used;
  return coalesce(used, 0);
end;
$$;

grant execute on function public.refund_generation() to authenticated;
