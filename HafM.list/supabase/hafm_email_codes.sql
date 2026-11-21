-- HafM.list — e-mail verification codes (applied to "fazat-dam" after hafm_schema.sql).
-- Switched by hafm_settings.require_email_code (admin toggle in the app: Account → E-mail verification code).
create table public.hafm_settings (key text primary key, value text not null);
insert into public.hafm_settings values ('require_email_code', 'false');
create table public.hafm_email_codes (
  email text primary key, code_hash text not null, expires_at timestamptz not null, attempts int not null default 0,
  last_sent timestamptz not null default now(), sent_hour_start timestamptz not null default now(), sent_in_hour int not null default 1
);
alter table public.hafm_settings enable row level security;
alter table public.hafm_email_codes enable row level security;
revoke all on public.hafm_settings, public.hafm_email_codes from anon, authenticated;
-- functions: hafm_code_required(), hafm_issue_code(email) [service_role only, used by the hafm-send-code Edge Function:
-- 6-digit code, bcrypt-hashed, 10 minutes, 1 per minute / 5 per hour], hafm_verify_code(email, code) [5 attempts],
-- hafm_user_status(email) now returns code_required, hafm_register(email, name, pin, code) requires the code when on
-- (and lets a verified user set a new PIN = self-service "forgot PIN"), hafm_set_code_required(token, on) / hafm_get_code_required(token) [admin].
-- Full definitions are in the Supabase migration history: hafm_email_codes, hafm_code_setting_rpc.
