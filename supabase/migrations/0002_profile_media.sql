-- Dedicated profile images. Paths point to the public profile-media bucket;
-- users may only upload/replace/delete files inside their own uid folder.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists banner_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile media: public read" on storage.objects;
drop policy if exists "profile media: own insert" on storage.objects;
drop policy if exists "profile media: own update" on storage.objects;
drop policy if exists "profile media: own delete" on storage.objects;

create policy "profile media: public read" on storage.objects
  for select using (bucket_id = 'profile-media');

create policy "profile media: own insert" on storage.objects
  for insert with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile media: own update" on storage.objects
  for update using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile media: own delete" on storage.objects
  for delete using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
