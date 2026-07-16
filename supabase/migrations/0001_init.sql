-- mysetup — initial Supabase schema
-- Paste this whole file into the Supabase dashboard → SQL Editor → New query → Run.
-- It is idempotent-ish (uses IF NOT EXISTS / CREATE OR REPLACE) so re-running is safe.
--
-- Model mirrors app/config/setup.js:
--   profiles            one row per auth user (premium flag + monthly generation counter)
--   setups              a battlestation: name, type, board layout/slots, photo, wallpaper
--   items               the universal gear library (shared across a user's setups)
--   generation_history  thumbnails of past AI Revamp results
--
-- Images are NOT stored in these tables — columns hold Storage URLs/paths, and the
-- bytes live in the storage buckets created at the bottom of this file.

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  is_premium          boolean not null default false,
  -- Monthly AI Revamp cap: count within the calendar month named by generations_month
  -- (format "YYYY-M", matching setup.js currentMonthKey()). Reset happens in app logic
  -- when the stored month no longer matches the current one.
  generations_count   integer not null default 0,
  generations_month   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── setups ──────────────────────────────────────────────────────────────────
create table if not exists public.setups (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  type              text not null default 'pc',
  photo_path        text,          -- Storage path in the "setup-photos" bucket
  wallpaper_path    text,          -- Storage path (monitor wallpaper video/image)
  dots              jsonb,         -- scan dots overlay
  board_layout      jsonb,         -- node geometry for the board
  slots             jsonb not null default '{}'::jsonb,  -- { [nodeId]: itemId }
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists setups_user_id_idx on public.setups (user_id);

-- ─── items (universal gear library) ──────────────────────────────────────────
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  product      jsonb not null,     -- the scanned/edited product metadata
  photo_path   text,               -- Storage path in the "item-photos" bucket
  is_cutout    boolean not null default true,
  added_at     timestamptz not null default now()
);
create index if not exists items_user_id_idx on public.items (user_id);

-- ─── generation_history ──────────────────────────────────────────────────────
create table if not exists public.generation_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  image_path   text not null,      -- Storage path in the "revamp-history" bucket
  created_at   timestamptz not null default now()
);
create index if not exists generation_history_user_id_idx on public.generation_history (user_id);

-- ─── Auto-create a profile row when a user signs up ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row-level security: every user sees only their own rows ─────────────────
alter table public.profiles           enable row level security;
alter table public.setups             enable row level security;
alter table public.items              enable row level security;
alter table public.generation_history enable row level security;

-- profiles: a user can read/update only their own profile (insert handled by trigger)
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- setups / items / generation_history: full CRUD scoped to the owning user
drop policy if exists "setups: own all" on public.setups;
create policy "setups: own all" on public.setups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items: own all" on public.items;
create policy "items: own all" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "history: own all" on public.generation_history;
create policy "history: own all" on public.generation_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Storage buckets ─────────────────────────────────────────────────────────
-- Private buckets; the app reads via signed URLs or the authenticated client.
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false),
       ('setup-photos', 'setup-photos', false),
       ('revamp-history', 'revamp-history', false)
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under a top-level folder named after
-- their own uid, i.e. paths like "<uid>/<file>". Upload code must prefix with the uid.
drop policy if exists "own objects: read"   on storage.objects;
drop policy if exists "own objects: insert" on storage.objects;
drop policy if exists "own objects: update" on storage.objects;
drop policy if exists "own objects: delete" on storage.objects;

create policy "own objects: read" on storage.objects
  for select using (
    bucket_id in ('item-photos','setup-photos','revamp-history')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own objects: insert" on storage.objects
  for insert with check (
    bucket_id in ('item-photos','setup-photos','revamp-history')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own objects: update" on storage.objects
  for update using (
    bucket_id in ('item-photos','setup-photos','revamp-history')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own objects: delete" on storage.objects
  for delete using (
    bucket_id in ('item-photos','setup-photos','revamp-history')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
