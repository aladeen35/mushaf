-- HafM.list — admins manage every list and the branches (apply after hafm_schema.sql and hafm_email_codes.sql).

-- ---------- lists: admins may delete any list; a recovery copy is kept ----------
create table if not exists public.hafm_trash (
  id bigint generated always as identity primary key,
  kind text not null default 'checklist',
  checklist jsonb not null,
  entries jsonb not null default '[]'::jsonb,
  deleted_by text not null,
  deleted_at timestamptz not null default now()
);
alter table public.hafm_trash enable row level security;
revoke all on public.hafm_trash from anon, authenticated;

drop function if exists public.hafm_delete_checklist(uuid, bigint);
create or replace function public.hafm_delete_checklist(p_token uuid, p_id bigint) returns int
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); r text := hafm_role_of(e); n int; c hafm_checklists;
begin
  if r not in ('editor', 'admin') then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  select * into c from hafm_checklists where id = p_id;
  if not found then return 0; end if;
  select count(*) into n from hafm_entries where checklist_id = p_id;
  if r <> 'admin' and (p_id in (1, 2) or n > 0) then raise exception 'hafm:has_entries' using errcode = 'P0001'; end if;
  insert into hafm_trash(checklist, entries, deleted_by)
  values (c.data || jsonb_build_object('archived', c.archived),
          coalesce((select jsonb_agg(to_jsonb(x)) from hafm_entries x where x.checklist_id = p_id), '[]'::jsonb), e);
  delete from hafm_checklists where id = p_id; -- its entries go with it (on delete cascade)
  return n;
end $$;

-- admins may edit Hot Cookies (2) and restore a deleted built-in list; the beverage list (1) keeps its items (Excel template)
create or replace function public.hafm_save_checklist(p_token uuid, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); r text := hafm_role_of(e); v_id bigint; v_data jsonb; old jsonb;
begin
  if r not in ('editor', 'admin') then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  v_id := nullif(p_list->>'id', '')::bigint;
  if v_id in (1, 2) and r <> 'admin' then raise exception 'hafm:locked_list' using errcode = 'P0001'; end if;
  if v_id is null or (v_id not in (1, 2) and not exists (select 1 from hafm_checklists where id = v_id)) then v_id := nextval('hafm_checklist_id_seq'); end if;
  v_data := (p_list - 'archived') || jsonb_build_object('id', v_id);
  select data into old from hafm_checklists where id = v_id;
  if v_id = 1 and old is not null then v_data := v_data || jsonb_build_object('items', old->'items', 'slug', 'beverage', 'kind', 'fixed'); end if;
  insert into hafm_checklists(id, data, archived, updated_by, updated_at) values (v_id, v_data, coalesce((p_list->>'archived')::boolean, false), e, now())
  on conflict (id) do update set data = excluded.data, archived = excluded.archived, updated_by = e, updated_at = now();
  return v_data || jsonb_build_object('archived', coalesce((p_list->>'archived')::boolean, false));
end $$;

-- ---------- branches: overrides on top of the 106 branches in the app (edit, add, delete = hide) ----------
create table if not exists public.hafm_branches (
  no int primary key check (no between 1 and 9999),
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.hafm_branches enable row level security;
revoke all on public.hafm_branches from anon, authenticated;

-- p_no null = a new branch (numbered after 106 and every branch added so far). Admins only.
create or replace function public.hafm_save_branch(p_token uuid, p_no int, p_data jsonb, p_deleted boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); v_no int := p_no; d jsonb;
begin
  if hafm_role_of(e) <> 'admin' then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  if v_no is null then select greatest(106, coalesce(max(no), 0)) + 1 into v_no from hafm_branches; end if;
  -- keep only the known fields
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into d from jsonb_each(coalesce(p_data, '{}'::jsonb)) as t(k, v)
    where k in ('code', 'name', 'aliasAr', 'aliasEn', 'cityEn', 'cityAr', 'regionEn', 'regionAr', 'manager', 'lat', 'lng');
  insert into hafm_branches(no, data, deleted, updated_by, updated_at) values (v_no, d, coalesce(p_deleted, false), e, now())
  on conflict (no) do update set data = excluded.data, deleted = excluded.deleted, updated_by = e, updated_at = now();
  return jsonb_build_object('no', v_no);
end $$;

-- the sync now also returns the branch overrides
create or replace function public.hafm_pull(p_token uuid, p_since timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  return jsonb_build_object(
    'server_time', now(),
    'me', jsonb_build_object('email', e, 'name', (select name from hafm_users where email = e), 'role', hafm_role_of(e)),
    'checklists', coalesce((select jsonb_agg(data || jsonb_build_object('archived', archived) order by id) from hafm_checklists), '[]'::jsonb),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('no', no, 'data', data, 'deleted', deleted) order by no) from hafm_branches), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('l', checklist_id, 'w', week_start, 'b', branch_no, 's', statuses, 'r', remarks,
        'a', auditor_name, 'e', auditor_email, 'h', history, 't', updated_at))
      from hafm_entries where p_since is null or updated_at > p_since - interval '2 minutes'), '[]'::jsonb));
end $$;

grant execute on function public.hafm_delete_checklist(uuid, bigint), public.hafm_save_checklist(uuid, jsonb),
  public.hafm_save_branch(uuid, int, jsonb, boolean), public.hafm_pull(uuid, timestamptz) to anon, authenticated;
