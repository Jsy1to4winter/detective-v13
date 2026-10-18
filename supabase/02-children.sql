-- Upgrade AFTER 01-install.sql. Existing main-page content/media stay intact.
begin;

do $$ begin
  if not exists (select 1 from public.detective_v13_page
    where id=1 and owner_id='12b1d5ba-432f-47b5-857d-793347769c16'::uuid) then
    raise exception 'Main-page administrator does not match. Run 01-install.sql first.';
  end if;
end $$;

-- A child may fill only the existing template fields, using its own media.
create or replace function public.detective_v13_valid_content(p_content jsonb, p_slug text)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; entry record; prefix text;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
    or (p_content - 'statement' - 'tags' - 'media') <> '{}'::jsonb then return false; end if;
  if p_content ? 'statement' then
    if jsonb_typeof(p_content->'statement') is distinct from 'string'
      or char_length(p_content->>'statement') > 3000 then return false; end if;
  end if;
  if p_content ? 'tags' then
    if jsonb_typeof(p_content->'tags') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_content->'tags') > 3 then return false; end if;
    for item in select value from jsonb_array_elements(p_content->'tags') loop
      if jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') > 4 then return false; end if;
    end loop;
  end if;
  if p_content ? 'media' then
    if jsonb_typeof(p_content->'media') is distinct from 'object' then return false; end if;
    prefix := 'https://uzjvnbaspmnxmzdjwgtl.supabase.co/storage/v1/object/public/detective-v13-media/profiles/' || p_slug || '/';
    for entry in select key,value from jsonb_each(p_content->'media') loop
      if entry.key !~ '^([0-2]-[0-5]|witness-portrait|poster-cover-[0-2]|case-background-music)$'
        or jsonb_typeof(entry.value) <> 'string' then return false; end if;
      if left(entry.value #>> '{}',char_length(prefix)) <> prefix
        or substring(entry.value #>> '{}' from char_length(prefix)+1) !~ '^[a-f0-9-]+\.(jpg|png|webp|gif|avif|mp3|m4a|aac|ogg|wav|webm)$' then return false; end if;
    end loop;
  end if;
  return true;
end $$;

create table if not exists public.detective_v13_profiles (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9_-]{2,63}$' and slug not in ('main','root')),
  owner_id uuid not null unique references auth.users(id),
  content jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint detective_v13_template_only check (public.detective_v13_valid_content(content,slug))
);
alter table public.detective_v13_profiles enable row level security;
revoke all on public.detective_v13_profiles from public,anon,authenticated;
grant select on public.detective_v13_profiles to anon,authenticated;
grant update(content) on public.detective_v13_profiles to authenticated;
grant select,insert,update,delete on public.detective_v13_profiles to service_role;

drop policy if exists detective_v13_child_read on public.detective_v13_profiles;
create policy detective_v13_child_read on public.detective_v13_profiles
for select to anon,authenticated using (true);
drop policy if exists detective_v13_child_write on public.detective_v13_profiles;
create policy detective_v13_child_write on public.detective_v13_profiles
for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop trigger if exists detective_v13_stamp on public.detective_v13_profiles;
create trigger detective_v13_stamp before update on public.detective_v13_profiles
for each row execute function public.detective_v13_stamp();

-- Internal identity directory. Passwords are managed/hashed by Supabase Auth.
create table if not exists public.detective_v13_editors (
  slug text primary key references public.detective_v13_profiles(slug),
  user_id uuid not null unique references auth.users(id),
  login_email text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.detective_v13_login_limits (
  slug text primary key references public.detective_v13_editors(slug),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.detective_v13_editors enable row level security;
alter table public.detective_v13_login_limits enable row level security;
revoke all on public.detective_v13_editors,public.detective_v13_login_limits from public,anon,authenticated;
grant all on public.detective_v13_editors,public.detective_v13_login_limits to service_role;

create or replace function public.detective_v13_take_login_attempt(p_slug text)
returns boolean language plpgsql set search_path='' as $$
declare n integer;
begin
  insert into public.detective_v13_login_limits as limits(slug,window_started_at,attempts)
  values(p_slug,clock_timestamp(),1)
  on conflict(slug) do update set
    window_started_at=case when limits.window_started_at < clock_timestamp()-interval '15 minutes' then clock_timestamp() else limits.window_started_at end,
    attempts=case when limits.window_started_at < clock_timestamp()-interval '15 minutes' then 1 else limits.attempts+1 end
  returning attempts into n;
  return n <= 20;
end $$;

create or replace function public.detective_v13_create_editor(p_slug text,p_user_id uuid,p_email text)
returns void language plpgsql set search_path='' as $$
begin
  if p_user_id='12b1d5ba-432f-47b5-857d-793347769c16'::uuid then raise exception 'Reserved administrator'; end if;
  insert into public.detective_v13_profiles(slug,owner_id,content) values(p_slug,p_user_id,'{}'::jsonb);
  insert into public.detective_v13_editors(slug,user_id,login_email) values(p_slug,p_user_id,p_email);
end $$;

create or replace function public.detective_v13_replace_editor(p_slug text,p_expected_user uuid,p_new_user uuid,p_email text)
returns void language plpgsql set search_path='' as $$
declare current_id uuid;
begin
  if p_new_user='12b1d5ba-432f-47b5-857d-793347769c16'::uuid then raise exception 'Reserved administrator'; end if;
  select user_id into current_id from public.detective_v13_editors where slug=p_slug for update;
  if current_id is null or current_id<>p_expected_user then raise exception 'Editor changed; retry'; end if;
  update public.detective_v13_profiles set owner_id=p_new_user where slug=p_slug and owner_id=current_id;
  if not found then raise exception 'Profile owner mismatch'; end if;
  update public.detective_v13_editors set user_id=p_new_user,login_email=p_email where slug=p_slug;
  delete from public.detective_v13_login_limits where slug=p_slug;
end $$;

revoke all on function public.detective_v13_take_login_attempt(text) from public,anon,authenticated;
revoke all on function public.detective_v13_create_editor(text,uuid,text) from public,anon,authenticated;
revoke all on function public.detective_v13_replace_editor(text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.detective_v13_take_login_attempt(text) to service_role;
grant execute on function public.detective_v13_create_editor(text,uuid,text) to service_role;
grant execute on function public.detective_v13_replace_editor(text,uuid,uuid,text) to service_role;

drop policy if exists detective_v13_child_media_insert on storage.objects;
create policy detective_v13_child_media_insert on storage.objects for insert to authenticated
with check (bucket_id='detective-v13-media' and (storage.foldername(name))[1]='profiles'
  and exists(select 1 from public.detective_v13_profiles p where p.slug=(storage.foldername(name))[2] and p.owner_id=auth.uid()));
drop policy if exists detective_v13_child_media_select on storage.objects;
create policy detective_v13_child_media_select on storage.objects for select to authenticated
using (bucket_id='detective-v13-media' and (storage.foldername(name))[1]='profiles'
  and exists(select 1 from public.detective_v13_profiles p where p.slug=(storage.foldername(name))[2] and p.owner_id=auth.uid()));
drop policy if exists detective_v13_child_media_delete on storage.objects;
create policy detective_v13_child_media_delete on storage.objects for delete to authenticated
using (bucket_id='detective-v13-media' and (storage.foldername(name))[1]='profiles'
  and exists(select 1 from public.detective_v13_profiles p where p.slug=(storage.foldername(name))[2] and p.owner_id=auth.uid()));

commit;
select 'detective-v13 child links installed' as result;
