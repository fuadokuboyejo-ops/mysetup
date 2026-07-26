-- Community feedback — signed-in users leave feedback; everyone signed in can
-- read it. Rows disappear with the account (on delete cascade).

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback: read"       on public.feedback;
drop policy if exists "feedback: own insert"  on public.feedback;
drop policy if exists "feedback: own delete"  on public.feedback;

create policy "feedback: read" on public.feedback
  for select to authenticated using (true);
create policy "feedback: own insert" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "feedback: own delete" on public.feedback
  for delete to authenticated using ((select auth.uid()) = user_id);
