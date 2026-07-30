-- Security hardening (audit 2026-07-30):
--
--   1. Profiles: stop exposing every column (is_premium, generation counters)
--      to every caller — and stop exposing anything to the anon role. The base
--      table becomes own-row-only; public discovery goes through a view that
--      contains only the public columns.
--   2. Cap bypass: generations_count/generations_month were still client-
--      writable, so a user could reset their own monthly AI counter. Revoke,
--      and make the metering RPCs security definer so they keep working.
--   3. account_private now actually hides the account's posts/setups/media.
--   4. Posts: likes/comments counters are no longer client-writable.
--   5. Per-user daily usage caps for the expensive edge functions (scan,
--      remove-bg), same locking pattern as consume_generation().

-- ─── 1. Profiles: own-row base table + public view ───────────────────────────
-- Replace the "everyone (even anon) reads everything" policy with own-row-only.
-- Own-row keeps full column access, so getIsPremium()/getGenerationsUsed() on
-- the client keep working untouched.
drop policy if exists "profiles: public read" on public.profiles;
drop policy if exists "profiles: own read" on public.profiles;
create policy "profiles: own read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- Public discovery (feed author cards, feedback author names) reads this view
-- instead. It is a SECURITY DEFINER view on purpose: its owner (postgres)
-- bypasses the profiles RLS so authenticated users can see OTHER users'
-- PUBLIC columns — and only these columns. Never add billing/usage columns.
create or replace view public.public_profiles as
  select id, username, display_name, bio, avatar_path, banner_path, account_private
  from public.profiles;

-- Explicit: definer semantics. If this were security_invoker the view would
-- inherit the caller's own-row-only RLS and the feed would silently go empty.
alter view public.public_profiles set (security_invoker = off);

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to authenticated;

-- RLS policies below need to check OTHER users' account_private flag, but a
-- policy subquery runs as the caller — and the caller can no longer read other
-- profiles. This definer helper is the one sanctioned peephole: it answers
-- exactly one yes/no question and nothing else.
create or replace function public.is_account_private(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select account_private from public.profiles where id = p_user),
    false
  );
$$;

revoke all on function public.is_account_private(uuid) from public, anon;
grant execute on function public.is_account_private(uuid) to authenticated;

-- ─── 2. Close the generation-cap bypass ──────────────────────────────────────
-- Like is_premium in 0007: the monthly counter may only move via the RPCs.
revoke update (generations_count, generations_month) on public.profiles from authenticated, anon;

-- consume_generation/refund_generation were SECURITY INVOKER, so the column
-- revoke above would break them. As SECURITY DEFINER they update the columns
-- with the function owner's rights while still metering only auth.uid()'s row.
create or replace function public.consume_generation()
returns table (allowed boolean, used_count integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  gen_limit constant integer := 100;
  month_key text := to_char(current_date, 'YYYY-FMMM');
  used integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

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

create or replace function public.refund_generation()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  month_key text := to_char(current_date, 'YYYY-FMMM');
  used integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
    set generations_count = greatest(generations_count - 1, 0),
        updated_at = now()
    where id = (select auth.uid()) and generations_month = month_key
    returning generations_count into used;
  return coalesce(used, 0);
end;
$$;

-- The pre-0006 self-metering RPC is superseded and has no callers — an unused
-- authenticated-executable function that writes profile counters is attack
-- surface, so drop it.
drop function if exists public.increment_generation_count();

-- ─── 3. Enforce account_private ──────────────────────────────────────────────
-- A private account's posts, published setups, and their media are visible to
-- the owner only. (Profile name/avatar stay visible via public_profiles, like
-- other social apps.)
drop policy if exists "posts: public read" on public.posts;
create policy "posts: public read" on public.posts
  for select to authenticated using (
    (select auth.uid()) = user_id
    or not public.is_account_private(posts.user_id)
  );

drop policy if exists "setups: readable" on public.setups;
create policy "setups: readable" on public.setups
  for select to authenticated using (
    (select auth.uid()) = user_id
    or (
      exists (select 1 from public.posts where posts.setup_id = setups.id)
      and not public.is_account_private(setups.user_id)
    )
  );

drop policy if exists "app media: readable" on storage.objects;
create policy "app media: readable" on storage.objects
  for select to authenticated using (
    (bucket_id in ('item-photos', 'setup-photos', 'revamp-history')
      and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id = 'item-photos' and exists (
      select 1 from public.items
      where items.photo_path = name and items.is_public
        and not public.is_account_private(items.user_id)
    ))
    or (bucket_id = 'setup-photos' and exists (
      select 1 from public.setups
      where (setups.photo_path = name
        or setups.wallpaper_path = name
        or name = any(setups.extra_photo_paths))
        and exists (select 1 from public.posts where posts.setup_id = setups.id)
        and not public.is_account_private(setups.user_id)
    ))
  );

-- ─── 4. Posts: counters are server-owned ─────────────────────────────────────
-- Owners could set likes/comments to anything on their own rows (feed-ranking
-- fraud). The client never writes them; when real likes ship they'll move
-- through an RPC/service role.
revoke insert (likes, comments) on public.posts from authenticated, anon;
revoke update (likes, comments) on public.posts from authenticated, anon;

-- ─── 5. Daily usage caps for expensive edge functions ────────────────────────
-- scan/remove-bg spend third-party quota per call; an authenticated user could
-- loop them for free. One row per user/kind/day; the pk makes the upsert atomic
-- and the row lock serializes concurrent calls (same pattern as
-- consume_generation). Limits are hardcoded server-side so no client can raise
-- them; calling the RPC directly only burns the caller's own quota.
create table if not exists public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null,
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, kind, day)
);

alter table public.usage_counters enable row level security;

drop policy if exists "usage: own read" on public.usage_counters;
create policy "usage: own read" on public.usage_counters
  for select to authenticated using ((select auth.uid()) = user_id);
-- No insert/update/delete policies: only the RPC below may write.

create or replace function public.consume_usage(p_kind text)
returns table (allowed boolean, used_count integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  quota integer;
  used integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  quota := case p_kind
    when 'scan' then 50
    when 'remove_bg' then 50
    else null
  end;
  if quota is null then
    raise exception 'Unknown usage kind %', p_kind;
  end if;

  insert into public.usage_counters as uc (user_id, kind, day, count)
  values ((select auth.uid()), p_kind, current_date, 1)
  on conflict (user_id, kind, day)
    do update set count = uc.count + 1
    where uc.count < quota
  returning uc.count into used;

  if used is null then
    -- Conflict row existed and was already at quota — denied.
    select count into used from public.usage_counters
      where user_id = (select auth.uid()) and kind = p_kind and day = current_date;
    return query select false, used, 0;
    return;
  end if;

  return query select true, used, quota - used;
end;
$$;

revoke all on function public.consume_usage(text) from public, anon;
grant execute on function public.consume_usage(text) to authenticated;
