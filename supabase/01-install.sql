-- detective-v13 / V13.17
-- Run the entire file in this project's Supabase SQL Editor.
-- Does not delete existing project data or modify other applications' tables.
begin;

do $$
begin
  if not exists (
    select 1 from auth.users
    where id = '12b1d5ba-432f-47b5-857d-793347769c16'::uuid
      and lower(email) = 'fuguang036@gmail.com'
  ) then
    raise exception 'Administrator account does not match. Check the project and Users page.';
  end if;
end $$;

create table if not exists public.detective_v13_page (
  id integer primary key check (id = 1),
  owner_id uuid not null references auth.users(id),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.detective_v13_page (id, owner_id)
values (1, '12b1d5ba-432f-47b5-857d-793347769c16')
on conflict (id) do nothing;

alter table public.detective_v13_page enable row level security;
revoke all on public.detective_v13_page from anon, authenticated;
grant select on public.detective_v13_page to anon, authenticated;
grant update (content) on public.detective_v13_page to authenticated;

drop policy if exists detective_v13_public_read on public.detective_v13_page;
create policy detective_v13_public_read on public.detective_v13_page
for select to anon, authenticated using (id = 1);

drop policy if exists detective_v13_owner_update on public.detective_v13_page;
create policy detective_v13_owner_update on public.detective_v13_page
for update to authenticated
using (id = 1 and owner_id = auth.uid())
with check (id = 1 and owner_id = auth.uid());

create or replace function public.detective_v13_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.detective_v13_stamp() from public;
drop trigger if exists detective_v13_stamp on public.detective_v13_page;
create trigger detective_v13_stamp before update on public.detective_v13_page
for each row execute function public.detective_v13_stamp();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('detective-v13-media', 'detective-v13-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif',
        'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm'])
on conflict (id) do nothing;

drop policy if exists detective_v13_media_insert on storage.objects;
create policy detective_v13_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'detective-v13-media'
  and auth.uid() = '12b1d5ba-432f-47b5-857d-793347769c16'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists detective_v13_media_select on storage.objects;
create policy detective_v13_media_select on storage.objects
for select to authenticated
using (
  bucket_id = 'detective-v13-media'
  and auth.uid() = '12b1d5ba-432f-47b5-857d-793347769c16'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists detective_v13_media_delete on storage.objects;
create policy detective_v13_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'detective-v13-media'
  and auth.uid() = '12b1d5ba-432f-47b5-857d-793347769c16'::uuid
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

select 'detective-v13 database installed' as result;
