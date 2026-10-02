-- طبقة محلية تحاكي ما توفّره Supabase مسبقاً، فتعمل ملفات الترحيل وسياسات RLS
-- كما هي على Postgres محلي. لا تُطبَّق على مشروع Supabase (الأدوار والدوال موجودة فيه).
--
-- auth.uid() تقرأ هوية المستخدم من request.jwt.claims كما في Supabase تماماً،
-- والتطبيق يضبطها لكل طلب مع SET LOCAL ROLE authenticated.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- يتيح لمستخدم الاتصال أن يبدّل دوره داخل المعاملة
grant anon, authenticated, service_role to current_user;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(current_setting('request.jwt.claim.sub', true), auth.jwt() ->> 'sub'),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), auth.jwt() ->> 'role')::text
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;
