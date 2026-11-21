-- HafM.list (Half Million quality lists) — shared database for all employees.
-- Target: Supabase project "fazat-dam". Every object is prefixed hafm_*; nothing else in the project is touched.
-- Access model: RLS on, no table grants to anon/authenticated. The browser only calls the hafm_* RPC functions
-- below (SECURITY DEFINER), which check a session token created by work e-mail + 4-digit PIN (bcrypt via pgcrypto).

create table public.hafm_users (
  email text primary key check (email = lower(email)),
  name text not null,
  pin_hash text,
  role text not null default 'auditor' check (role in ('auditor','editor','admin')),
  fails int not null default 0,
  lock_until timestamptz,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create table public.hafm_admin_hashes (hash text primary key);
create table public.hafm_sessions (
  token uuid primary key default gen_random_uuid(),
  email text not null references public.hafm_users(email) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 hours'
);
create index hafm_sessions_email_idx on public.hafm_sessions(email);
create sequence public.hafm_checklist_id_seq start 100;
create table public.hafm_checklists (
  id bigint primary key,
  data jsonb not null,
  archived boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table public.hafm_entries (
  checklist_id bigint not null references public.hafm_checklists(id) on delete cascade,
  week_start date not null,
  branch_no int not null check (branch_no between 1 and 999),
  statuses jsonb not null default '{}'::jsonb,
  remarks text not null default '',
  auditor_name text,
  auditor_email text,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (checklist_id, week_start, branch_no)
);
create index hafm_entries_updated_idx on public.hafm_entries(updated_at);

alter table public.hafm_users enable row level security;
alter table public.hafm_admin_hashes enable row level security;
alter table public.hafm_sessions enable row level security;
alter table public.hafm_checklists enable row level security;
alter table public.hafm_entries enable row level security;
revoke all on public.hafm_users, public.hafm_admin_hashes, public.hafm_sessions, public.hafm_checklists, public.hafm_entries from anon, authenticated;
revoke all on sequence public.hafm_checklist_id_seq from anon, authenticated;

-- permanent admin (SHA-256 of 'hafm-admin|<email>', same value as config.js)
insert into public.hafm_admin_hashes values ('66500de8f602aa7295e3331bbe06db6e9e0ff34bb28759bebe8b91eb04e103c5');

-- built-in lists (ids 1 and 2 match the app)
insert into public.hafm_checklists (id, data) values
(1, '{"id":1,"name":"Beverage Quality Checklist","nameAr":"فحص جودة المشروبات","kind":"fixed","slug":"beverage","icon":"coffee","locked":true,"items":[{"id":"hibiscus","label":"Hibiscus","labelAr":"كركديه"},{"id":"passion-fruit","label":"Passion Fruit","labelAr":"باشن فروت"},{"id":"matcha","label":"Matcha","labelAr":"ماتشا"},{"id":"hot-chocolate","label":"Hot Chocolate","labelAr":"شوكولاتة ساخنة"},{"id":"espresso","label":"Espresso","labelAr":"إسبريسو"},{"id":"ethiopian-drip-hot","label":"Ethiopian Drip (Hot)","labelAr":"تقطير إثيوبي ساخن"},{"id":"ethiopian-drip-cold","label":"Ethiopian Drip (Cold)","labelAr":"تقطير إثيوبي بارد"},{"id":"brazil-hot","label":"Brazil (Hot)","labelAr":"برازيلي ساخن"},{"id":"brazil-cold","label":"Brazil (Cold)","labelAr":"برازيلي بارد"}]}'),
(2, '{"id":2,"name":"Hot Cookies","nameAr":"هوت كوكيز","kind":"survey","slug":"hot-cookies","icon":"cookie","locked":true,"items":[{"id":"staff-knowledge","label":"Staff knowledge — Hot Cookies SOPs & specifications","labelAr":"معرفة الموظفين — إجراءات ومواصفات Hot Cookies"},{"id":"parchment-paper","label":"Small parchment paper usage","labelAr":"استخدام ورق الزبدة الصغير"},{"id":"turbo-chef-280","label":"Turbo Chef temperature at 280 °C","labelAr":"حرارة توربو شيف 280°"}]}');

-- ---------- helpers ----------
create or replace function public.hafm_role_of(p_email text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when exists (select 1 from hafm_admin_hashes where hash = encode(extensions.digest('hafm-admin|' || p_email, 'sha256'), 'hex')) then 'admin'
    else coalesce((select role from hafm_users where email = p_email), 'auditor') end;
$$;
create or replace function public.hafm_session_email(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select email into v from hafm_sessions where token = p_token and expires_at > now();
  if v is null then raise exception 'hafm:session_expired' using errcode = 'P0001'; end if;
  return v;
end $$;
create or replace function public.hafm_new_session(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_token uuid; u hafm_users;
begin
  delete from hafm_sessions where expires_at < now();
  insert into hafm_sessions(email) values (p_email) returning token into v_token;
  update hafm_users set last_login = now(), fails = 0, lock_until = null where email = p_email returning * into u;
  return jsonb_build_object('token', v_token, 'email', u.email, 'name', u.name, 'role', hafm_role_of(u.email));
end $$;
create or replace function public.hafm_check_email(p_email text) returns text
language plpgsql immutable as $$
declare e text := lower(trim(p_email));
begin
  if e !~ '^[^\s@]+@halfm\.sa$' then raise exception 'hafm:email_domain' using errcode = 'P0001'; end if;
  return e;
end $$;
create or replace function public.hafm_check_pin(p_pin text) returns void
language plpgsql immutable as $$
begin
  if p_pin !~ '^\d{4}$' then raise exception 'hafm:pin_format' using errcode = 'P0001'; end if;
end $$;

-- ---------- auth ----------
create or replace function public.hafm_user_status(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_check_email(p_email); u hafm_users;
begin
  select * into u from hafm_users where email = e;
  if not found then return jsonb_build_object('exists', false); end if;
  return jsonb_build_object('exists', true, 'has_pin', u.pin_hash is not null, 'name', u.name);
end $$;
create or replace function public.hafm_register(p_email text, p_name text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := hafm_check_email(p_email); u hafm_users;
begin
  perform hafm_check_pin(p_pin);
  select * into u from hafm_users where email = e for update;
  if found and u.pin_hash is not null then raise exception 'hafm:already_registered' using errcode = 'P0001'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 and not found then raise exception 'hafm:name' using errcode = 'P0001'; end if;
  insert into hafm_users(email, name, pin_hash) values (e, trim(p_name), crypt(p_pin, gen_salt('bf', 8)))
  on conflict (email) do update set pin_hash = excluded.pin_hash, fails = 0, lock_until = null,
     name = case when length(trim(coalesce(p_name, ''))) >= 3 then trim(p_name) else hafm_users.name end;
  return hafm_new_session(e);
end $$;
create or replace function public.hafm_login(p_email text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare e text := hafm_check_email(p_email); u hafm_users;
begin
  select * into u from hafm_users where email = e for update;
  if not found or u.pin_hash is null then raise exception 'hafm:not_registered' using errcode = 'P0001'; end if;
  if u.lock_until is not null and u.lock_until > now() then
    raise exception 'hafm:locked:%', ceil(extract(epoch from u.lock_until - now()))::int using errcode = 'P0001';
  end if;
  if crypt(coalesce(p_pin, ''), u.pin_hash) <> u.pin_hash then
    update hafm_users set fails = case when fails + 1 >= 5 then 0 else fails + 1 end,
      lock_until = case when fails + 1 >= 5 then now() + interval '60 seconds' else lock_until end where email = e;
    return jsonb_build_object('error', 'wrong_pin');
  end if;
  return hafm_new_session(e);
end $$;
create or replace function public.hafm_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$ delete from hafm_sessions where token = p_token; $$;
create or replace function public.hafm_me(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); u hafm_users;
begin
  select * into u from hafm_users where email = e;
  return jsonb_build_object('email', u.email, 'name', u.name, 'role', hafm_role_of(e));
end $$;
create or replace function public.hafm_change_pin(p_token uuid, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare e text := hafm_session_email(p_token); u hafm_users;
begin
  perform hafm_check_pin(p_new);
  select * into u from hafm_users where email = e;
  if crypt(coalesce(p_old, ''), u.pin_hash) <> u.pin_hash then raise exception 'hafm:wrong_pin' using errcode = 'P0001'; end if;
  update hafm_users set pin_hash = crypt(p_new, gen_salt('bf', 8)) where email = e;
end $$;
create or replace function public.hafm_set_name(p_token uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'hafm:name' using errcode = 'P0001'; end if;
  update hafm_users set name = trim(p_name) where email = e;
end $$;

-- ---------- data ----------
create or replace function public.hafm_pull(p_token uuid, p_since timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  return jsonb_build_object(
    'server_time', now(),
    'me', jsonb_build_object('email', e, 'name', (select name from hafm_users where email = e), 'role', hafm_role_of(e)),
    'checklists', coalesce((select jsonb_agg(data || jsonb_build_object('archived', archived) order by id) from hafm_checklists), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(jsonb_build_object('l', checklist_id, 'w', week_start, 'b', branch_no, 's', statuses, 'r', remarks,
        'a', auditor_name, 'e', auditor_email, 'h', history, 't', updated_at))
      from hafm_entries where p_since is null or updated_at > p_since - interval '2 minutes'), '[]'::jsonb));
end $$;
create or replace function public.hafm_save_entry(p_token uuid, p_checklist_id bigint, p_week_start date, p_branch_no int, p_statuses jsonb, p_remarks text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); n text; old hafm_entries; r hafm_entries;
begin
  if extract(dow from p_week_start) <> 6 then raise exception 'hafm:week_start' using errcode = 'P0001'; end if;
  if not exists (select 1 from hafm_checklists where id = p_checklist_id) then raise exception 'hafm:no_list' using errcode = 'P0001'; end if;
  select name into n from hafm_users where email = e;
  select * into old from hafm_entries where checklist_id = p_checklist_id and week_start = p_week_start and branch_no = p_branch_no;
  insert into hafm_entries(checklist_id, week_start, branch_no, statuses, remarks, auditor_name, auditor_email, history, updated_at)
  values (p_checklist_id, p_week_start, p_branch_no, coalesce(p_statuses, '{}'::jsonb), left(coalesce(p_remarks, ''), 2000), n, e, '[]'::jsonb, now())
  on conflict (checklist_id, week_start, branch_no) do update set statuses = excluded.statuses, remarks = excluded.remarks,
    auditor_name = excluded.auditor_name, auditor_email = excluded.auditor_email, updated_at = now(),
    history = (case when old.auditor_name is not null then (hafm_entries.history || jsonb_build_array(jsonb_build_object('auditor', old.auditor_name, 'at', old.updated_at))) else hafm_entries.history end)
  returning * into r;
  return jsonb_build_object('t', r.updated_at, 'a', r.auditor_name);
end $$;
create or replace function public.hafm_save_checklist(p_token uuid, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); v_id bigint; v_data jsonb;
begin
  if hafm_role_of(e) not in ('editor', 'admin') then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  v_id := nullif(p_list->>'id', '')::bigint;
  if v_id in (1, 2) then raise exception 'hafm:locked_list' using errcode = 'P0001'; end if;
  if v_id is null or not exists (select 1 from hafm_checklists where id = v_id) then v_id := nextval('hafm_checklist_id_seq'); end if;
  v_data := (p_list - 'archived') || jsonb_build_object('id', v_id);
  insert into hafm_checklists(id, data, archived, updated_by, updated_at) values (v_id, v_data, coalesce((p_list->>'archived')::boolean, false), e, now())
  on conflict (id) do update set data = excluded.data, archived = excluded.archived, updated_by = e, updated_at = now();
  return v_data || jsonb_build_object('archived', coalesce((p_list->>'archived')::boolean, false));
end $$;
create or replace function public.hafm_delete_checklist(p_token uuid, p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  if hafm_role_of(e) not in ('editor', 'admin') then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  if p_id in (1, 2) or exists (select 1 from hafm_entries where checklist_id = p_id) then raise exception 'hafm:has_entries' using errcode = 'P0001'; end if;
  delete from hafm_checklists where id = p_id;
end $$;

-- ---------- admin ----------
create or replace function public.hafm_list_users(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  if hafm_role_of(e) <> 'admin' then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', email, 'name', name, 'role', hafm_role_of(email), 'has_pin', pin_hash is not null,
     'last_login', last_login, 'entries', (select count(*) from hafm_entries x where x.auditor_email = u.email)) order by last_login desc nulls last)
     from hafm_users u), '[]'::jsonb);
end $$;
create or replace function public.hafm_set_role(p_token uuid, p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token); t text := hafm_check_email(p_email);
begin
  if hafm_role_of(e) <> 'admin' then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  if p_role not in ('auditor', 'editor', 'admin') then raise exception 'hafm:role' using errcode = 'P0001'; end if;
  insert into hafm_users(email, name, role) values (t, split_part(t, '@', 1), p_role)
  on conflict (email) do update set role = p_role;
end $$;
create or replace function public.hafm_reset_pin(p_token uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := hafm_session_email(p_token);
begin
  if hafm_role_of(e) <> 'admin' then raise exception 'hafm:forbidden' using errcode = 'P0001'; end if;
  update hafm_users set pin_hash = null, fails = 0, lock_until = null where email = lower(p_email);
  delete from hafm_sessions where email = lower(p_email);
end $$;

-- only the RPC entry points are callable from the browser
revoke execute on function public.hafm_role_of(text), public.hafm_session_email(uuid), public.hafm_new_session(text) from public, anon, authenticated;
grant execute on function public.hafm_user_status(text), public.hafm_register(text, text, text), public.hafm_login(text, text), public.hafm_logout(uuid),
  public.hafm_me(uuid), public.hafm_change_pin(uuid, text, text), public.hafm_set_name(uuid, text), public.hafm_pull(uuid, timestamptz),
  public.hafm_save_entry(uuid, bigint, date, int, jsonb, text), public.hafm_save_checklist(uuid, jsonb), public.hafm_delete_checklist(uuid, bigint),
  public.hafm_list_users(uuid), public.hafm_set_role(uuid, text, text), public.hafm_reset_pin(uuid, text) to anon, authenticated;
