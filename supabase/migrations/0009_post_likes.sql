-- post_likes — adopt the dashboard-created table into migrations (it existed
-- in production only; this file makes the repo the source of truth) and give
-- it known-good RLS + the counter-maintaining RPC.
--
-- Context: migration 0008 revoked client writes on posts.likes, so the ONLY
-- way the counter can move is toggle_post_like() below (security definer).
-- The client currently stores "collections" locally; when real likes ship in
-- the UI, call: supabase.rpc('toggle_post_like', { p_post_id: <uuid> })

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

-- Own rows only: you can see, add, and remove YOUR likes. Like-counts are read
-- from posts.likes, not by enumerating this table, so nobody can list who
-- liked a post. The insert check subqueries posts as the caller, so its RLS
-- applies — likes can only target posts the liker is allowed to see (which
-- excludes private accounts' posts, per 0008).
-- The table predates this file (created in the dashboard), so drop whatever
-- policies it accumulated there — regardless of name — before installing the
-- known-good set. Makes this migration the single authority.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
  loop
    execute format('drop policy %I on public.post_likes', pol.policyname);
  end loop;
end $$;

create policy "post_likes: own read" on public.post_likes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "post_likes: own insert" on public.post_likes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts where posts.id = post_id)
  );
create policy "post_likes: own delete" on public.post_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Like/unlike in one call, keeping posts.likes in sync. SECURITY DEFINER for
-- two reasons: posts.likes is column-revoked for clients (0008), and the
-- counter update must not depend on the caller's row visibility. Visibility is
-- checked explicitly instead: the target post must be public-readable to the
-- caller (own, or owner not private).
create or replace function public.toggle_post_like(p_post_id uuid)
returns table (liked boolean, likes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  post_owner uuid;
  now_liked boolean;
  new_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select user_id into post_owner from public.posts where id = p_post_id for update;
  if post_owner is null then
    raise exception 'Post not found';
  end if;
  if post_owner <> uid and public.is_account_private(post_owner) then
    raise exception 'Post not found'; -- private account: same error as missing
  end if;

  delete from public.post_likes
    where post_id = p_post_id and user_id = uid;
  if found then
    now_liked := false;
  else
    insert into public.post_likes (post_id, user_id) values (p_post_id, uid);
    now_liked := true;
  end if;

  -- Recount instead of +-1: self-heals any drift and is trivially correct
  -- under the post-row lock taken above.
  update public.posts
    set likes = (select count(*) from public.post_likes where post_id = p_post_id),
        updated_at = now()
    where id = p_post_id
    returning public.posts.likes into new_count;

  return query select now_liked, new_count;
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public, anon;
grant execute on function public.toggle_post_like(uuid) to authenticated;
