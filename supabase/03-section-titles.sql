-- Allow the three editable template section titles. Preserves all existing data.
begin;
create or replace function public.detective_v13_valid_content(p_content jsonb, p_slug text)
returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; entry record; prefix text;
begin
  if jsonb_typeof(p_content) is distinct from 'object'
    or (p_content - 'statement' - 'tags' - 'media' - 'sectionTitles') <> '{}'::jsonb then return false; end if;
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
  if p_content ? 'sectionTitles' then
    if jsonb_typeof(p_content->'sectionTitles') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_content->'sectionTitles') <> 3 then return false; end if;
    for item in select value from jsonb_array_elements(p_content->'sectionTitles') loop
      if jsonb_typeof(item) <> 'string' or char_length(btrim(item #>> '{}')) = 0
        or char_length(item #>> '{}') > 12 then return false; end if;
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

commit;
select 'detective-v13 section titles installed' as result;
