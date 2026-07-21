-- Complete the app data model and make Supabase the source of truth for all
-- user-owned content. Client-side access remains protected by row-level
-- security; public posts expose only the setups/items that were published.

alter table public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists bio text not null default '',
  add column if not exists account_private boolean not null default false;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username)) where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  fallback_username text := 'user-' || left(new.id::text, 8);
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    fallback_username,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      fallback_username
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.items
  add column if not exists is_public boolean not null default false;

alter table public.setups
  add column if not exists extra_photo_paths text[] not null default '{}';

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  setup_id    uuid not null references public.setups (id) on delete cascade,
  title       text not null,
  caption     text not null default '',
  tags        text[] not null default '{}',
  likes       integer not null default 0 check (likes >= 0),
  comments    integer not null default 0 check (comments >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_setup_id_idx on public.posts (setup_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

-- Replace the broad owner policies with explicit operation policies so public
-- reads can coexist with owner-only writes.
drop policy if exists "profiles: own read" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: own update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "setups: own all" on public.setups;
drop policy if exists "setups: readable" on public.setups;
drop policy if exists "setups: own insert" on public.setups;
drop policy if exists "setups: own update" on public.setups;
drop policy if exists "setups: own delete" on public.setups;
create policy "setups: readable" on public.setups
  for select to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.posts where posts.setup_id = setups.id)
  );
create policy "setups: own insert" on public.setups
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "setups: own update" on public.setups
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "setups: own delete" on public.setups
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "items: own all" on public.items;
drop policy if exists "items: readable" on public.items;
drop policy if exists "items: own insert" on public.items;
drop policy if exists "items: own update" on public.items;
drop policy if exists "items: own delete" on public.items;
create policy "items: readable" on public.items
  for select to authenticated using ((select auth.uid()) = user_id or is_public);
create policy "items: own insert" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "items: own update" on public.items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "items: own delete" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "posts: public read" on public.posts;
drop policy if exists "posts: own insert" on public.posts;
drop policy if exists "posts: own update" on public.posts;
drop policy if exists "posts: own delete" on public.posts;
create policy "posts: public read" on public.posts
  for select to authenticated using (true);
create policy "posts: own insert" on public.posts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.setups
      where setups.id = setup_id and setups.user_id = (select auth.uid())
    )
  );
create policy "posts: own update" on public.posts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "posts: own delete" on public.posts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Delete a setup and privatize everything placed or tagged in it in one
-- database transaction. Posts disappear through the setup foreign key.
create or replace function public.delete_setup(p_setup_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_setup public.setups%rowtype;
begin
  select * into target_setup
  from public.setups
  where id = p_setup_id and user_id = (select auth.uid());

  if not found then
    raise exception 'Setup not found or not owned by the current user';
  end if;

  update public.items
  set is_public = false
  where user_id = (select auth.uid())
    and (
      id::text in (
        select value #>> '{}'
        from jsonb_each(coalesce(target_setup.slots, '{}'::jsonb))
      )
      or id::text in (
        select dot->>'libraryItemId'
        from jsonb_array_elements(coalesce(target_setup.dots, '[]'::jsonb)) as dot
      )
    );

  delete from public.setups
  where id = p_setup_id and user_id = (select auth.uid());
end;
$$;

grant execute on function public.delete_setup(uuid) to authenticated;

-- Increment the monthly AI usage counter atomically, including the calendar
-- month rollover that was previously done only on the device.
create or replace function public.increment_generation_count()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  month_key text := to_char(current_date, 'YYYY-FMMM');
  next_count integer;
begin
  update public.profiles
  set generations_count = case
        when generations_month = month_key then generations_count + 1
        else 1
      end,
      generations_month = month_key,
      updated_at = now()
  where id = (select auth.uid())
  returning generations_count into next_count;

  if next_count is null then
    raise exception 'Profile not found for current user';
  end if;
  return next_count;
end;
$$;

grant execute on function public.increment_generation_count() to authenticated;

-- Make sure users created before the profile trigger was installed are covered.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

update public.profiles
set username = 'user-' || left(id::text, 8)
where username is null;

update public.profiles
set display_name = username
where display_name is null;

-- Setup/item files remain private objects. Authenticated users may read their
-- own files, while media belonging to published rows can also be signed/read.
drop policy if exists "own objects: read" on storage.objects;
drop policy if exists "app media: readable" on storage.objects;
create policy "app media: readable" on storage.objects
  for select to authenticated using (
    (bucket_id in ('item-photos', 'setup-photos', 'revamp-history')
      and (storage.foldername(name))[1] = (select auth.uid())::text)
    or (bucket_id = 'item-photos' and exists (
      select 1 from public.items where items.photo_path = name and items.is_public
    ))
    or (bucket_id = 'setup-photos' and exists (
      select 1 from public.setups
      where (setups.photo_path = name
        or setups.wallpaper_path = name
        or name = any(setups.extra_photo_paths))
        and exists (select 1 from public.posts where posts.setup_id = setups.id)
    ))
  );
