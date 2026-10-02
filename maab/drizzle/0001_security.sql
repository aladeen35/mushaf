-- ═══════════════════════════════════════════════════════════════════════
-- الأمان والقيود الحرجة (القسمان 13 و15): الصلاحية تُفحص في ثلاث طبقات،
-- وهذه الطبقة الأخيرة في قاعدة البيانات نفسها، فلا تُعتمد الواجهة وحدها أبداً.
--
-- كل طلب مستخدم يُنفَّذ بدور authenticated وهويته في auth.uid()، والعمليات
-- المركّبة (الاعتماد، توليد الحصص، التسجيل) بدور service_role بعد فحص
-- الصلاحية في الخادم، وتُكتب في سجل التدقيق.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists btree_gist;
--> statement-breakpoint
create schema if not exists app;
--> statement-breakpoint

-- ——— دوال الهوية والأدوار (SECURITY DEFINER حتى لا تتكرر سياسات RLS داخلها) ———

create or replace function app.has_role(r public.role_key) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = r)
$$;
--> statement-breakpoint
create or replace function app.has_any_role(rs public.role_key[]) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = any(rs))
$$;
--> statement-breakpoint
-- المشرفة والمدير العام: الإشراف الأكاديمي الكامل
create or replace function app.is_academic() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select app.has_any_role(array['supervisor', 'super_admin']::public.role_key[]) $$;
--> statement-breakpoint
-- من يرى الحسابات والمواعيد للدعم: المشرفة والدعم والمدير العام
create or replace function app.is_operations() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select app.has_any_role(array['supervisor', 'support', 'super_admin']::public.role_key[]) $$;
--> statement-breakpoint
-- من يرى المستندات المالية: المالية والمدير العام (الدعم لا يراها)
create or replace function app.is_finance() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select app.has_any_role(array['finance', 'super_admin']::public.role_key[]) $$;
--> statement-breakpoint
create or replace function app.my_guardian_id() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select id from public.guardians where user_id = auth.uid() and deleted_at is null $$;
--> statement-breakpoint
create or replace function app.my_teacher_id() returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$ select id from public.teachers where user_id = auth.uid() and deleted_at is null $$;
--> statement-breakpoint
create or replace function app.is_guardian_of(s uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.guardian_students gs
    join public.guardians g on g.id = gs.guardian_id
    where gs.student_id = s and g.user_id = auth.uid() and g.deleted_at is null
  )
$$;
--> statement-breakpoint
-- المعلمة ترى طلابها المسندين إليها فقط، ومن تعوّضه في حصة قريبة
create or replace function app.teaches(s uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.students st join public.teachers t on t.id = st.teacher_id
    where st.id = s and t.user_id = auth.uid() and st.deleted_at is null
  ) or exists (
    select 1 from public.sessions se join public.teachers t on t.id = se.teacher_id
    where se.student_id = s and t.user_id = auth.uid() and se.starts_at > now() - interval '30 days'
  )
$$;
--> statement-breakpoint
create or replace function app.can_read_student(s uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select app.is_guardian_of(s)
      or exists (select 1 from public.students where id = s and user_id = auth.uid())
      or app.teaches(s)
      or app.is_operations()
$$;
--> statement-breakpoint
create or replace function app.can_read_session(sid uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.sessions se
    where se.id = sid
      and (se.teacher_id = app.my_teacher_id() or app.is_guardian_of(se.student_id)
           or exists (select 1 from public.students where id = se.student_id and user_id = auth.uid())
           or app.is_operations())
  )
$$;
--> statement-breakpoint
create or replace function app.owns_order(o uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.orders where id = o and guardian_id = app.my_guardian_id()) $$;
--> statement-breakpoint
create or replace function app.can_read_report(r uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.session_reports where id = r and app.can_read_student(student_id)) $$;
--> statement-breakpoint
create or replace function app.writes_report(r uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.session_reports where id = r and teacher_id = app.my_teacher_id())
      or app.is_academic()
$$;
--> statement-breakpoint
-- اسم الطالب للمالية دون بقية بياناته («الاسم فقط» في مصفوفة الصلاحيات)
create or replace function app.student_name(s uuid) returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when app.is_finance() or app.can_read_student(s) then full_name end
  from public.students where id = s
$$;
--> statement-breakpoint

-- ——— الرقم المرجعي السنوي ———

create or replace function app.next_order_ref(y smallint default extract(year from now())::smallint) returns text
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into public.ref_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.ref_counters.last + 1
  returning last into n;
  if n > 999999 then raise exception 'order ref sequence exhausted for %', y; end if;
  return format('MAAB-%s-%s', y, lpad(n::text, 6, '0'));
end
$$;
--> statement-breakpoint

-- ——— المشغّلات ———

create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;
--> statement-breakpoint
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function app.touch_updated_at()', t, t);
  end loop;
end
$$;
--> statement-breakpoint

-- الفاصل الإلزامي 5 دقائق بين الحصص: blocked_until = النهاية + 5 دقائق.
-- (جمع interval على timestamptz غير ثابت فلا يُستعمل في قيد EXCLUDE مباشرة)
create or replace function app.sessions_set_blocked_until() returns trigger
language plpgsql as $$
begin
  new.blocked_until := new.ends_at + interval '5 minutes';
  return new;
end
$$;
--> statement-breakpoint
create trigger sessions_blocked_until before insert or update of starts_at, ends_at on public.sessions
for each row execute function app.sessions_set_blocked_until();
--> statement-breakpoint

-- منع التعارض للمعلمة والطالب معاً، في قاعدة البيانات نفسها حتى لو وصل طلبان في اللحظة نفسها
alter table public.sessions add constraint sessions_teacher_no_overlap
  exclude using gist (teacher_id with =, tstzrange(starts_at, blocked_until, '[)') with &&)
  where (status <> 'cancelled');
--> statement-breakpoint
alter table public.sessions add constraint sessions_student_no_overlap
  exclude using gist (student_id with =, tstzrange(starts_at, blocked_until, '[)') with &&)
  where (status <> 'cancelled');
--> statement-breakpoint

-- الرصيد يُخصم داخل المعاملة نفسها مع تغيير حالة الحصة (القسم 7):
-- الحضور والغياب دون إشعار يخصمان، والبقية لا تخصم، والتعويضية لا تُخصم أبداً.
create or replace function app.sessions_balance() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  was boolean := old.status in ('completed', 'student_absent');
  now_deducts boolean := new.status in ('completed', 'student_absent');
begin
  if new.subscription_id is null or new.is_makeup or was = now_deducts then
    return new;
  end if;
  update public.subscriptions
     set sessions_remaining = sessions_remaining + case when now_deducts then -1 else 1 end
   where id = new.subscription_id;
  return new;
end
$$;
--> statement-breakpoint
create trigger sessions_balance after update of status on public.sessions
for each row execute function app.sessions_balance();
--> statement-breakpoint

-- قبول الطالب: الأولاد حتى العمر المحدد في الإعدادات (12)، وأقل عمر 4 سنوات
create or replace function app.students_eligibility() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  max_boy integer := coalesce((select (value #>> '{}')::integer from public.settings where key = 'max_boy_age'), 12);
  years integer := date_part('year', age(current_date, new.birth_date));
begin
  if years < 4 then
    raise exception 'student_too_young' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and new.gender = 'male' and years > max_boy then
    raise exception 'boy_too_old' using errcode = 'P0001', detail = format('max_boy_age=%s', max_boy);
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger students_eligibility before insert or update of birth_date, gender on public.students
for each row execute function app.students_eligibility();
--> statement-breakpoint

-- المعلمة المسندة تدرّس فئة الطالب: أطفال دون 18، ونساء من 18
create or replace function app.students_teacher_category() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cat public.teacher_category := case when date_part('year', age(current_date, new.birth_date)) >= 18 then 'women' else 'children' end;
begin
  if new.teacher_id is not null and not exists (
    select 1 from public.teachers where id = new.teacher_id and cat = any(categories) and status = 'active'
  ) then
    raise exception 'teacher_category_mismatch' using errcode = 'P0001';
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger students_teacher_category before insert or update of teacher_id, birth_date on public.students
for each row execute function app.students_teacher_category();
--> statement-breakpoint

-- التقرير يطابق حصته: المعلمة والطالب نفسهما، ويُعلَّم متأخراً بعد 12 ساعة من نهايتها
create or replace function app.session_reports_consistency() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare se public.sessions;
begin
  select * into se from public.sessions where id = new.session_id;
  if se.id is null or se.teacher_id <> new.teacher_id or se.student_id <> new.student_id then
    raise exception 'report_session_mismatch' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.late := now() > se.ends_at + interval '12 hours';
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger session_reports_consistency before insert or update of session_id, teacher_id, student_id on public.session_reports
for each row execute function app.session_reports_consistency();
--> statement-breakpoint

-- سجلات لا تُعدَّل: الدفع لا يتغير إلا من دور النظام، والإيصالات والاسترداد
-- لا تُعدَّل ولا تُحذف أبداً، وسجل التدقيق يُحذف منه ما تجاوز 3 سنوات فقط وبدور النظام.
create or replace function app.payments_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'payments are append-only' using errcode = '42501';
  end if;
  if current_user <> 'service_role' then
    raise exception 'payments can only be changed by the system role' using errcode = '42501';
  end if;
  if old.amount <> new.amount or old.currency <> new.currency or old.order_id <> new.order_id then
    raise exception 'payment amount, currency and order are immutable' using errcode = '42501';
  end if;
  return new;
end
$$;
--> statement-breakpoint
create trigger payments_guard before update or delete on public.payments
for each row execute function app.payments_guard();
--> statement-breakpoint
create or replace function app.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end
$$;
--> statement-breakpoint
create trigger payment_receipts_immutable before update or delete on public.payment_receipts
for each row execute function app.forbid_change();
--> statement-breakpoint
create trigger refunds_immutable before update or delete on public.refunds
for each row execute function app.forbid_change();
--> statement-breakpoint
create or replace function app.audit_logs_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_user = 'service_role' and old.created_at < now() - interval '3 years' then
    return old;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '42501';
end
$$;
--> statement-breakpoint
create trigger audit_logs_guard before update or delete on public.audit_logs
for each row execute function app.audit_logs_guard();
--> statement-breakpoint

-- ——— الصلاحيات على مستوى الجداول ———

grant usage on schema public, app to anon, authenticated, service_role;
--> statement-breakpoint
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
--> statement-breakpoint
grant usage, select on all sequences in schema public to authenticated, service_role;
--> statement-breakpoint
grant execute on all functions in schema app to anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function app.next_order_ref(smallint) from public, anon, authenticated;
--> statement-breakpoint
grant select on public.quran_surahs, public.quran_ayahs, public.tafsir_sources, public.tafsir_entries,
  public.azkar, public.daily_wird, public.plans, public.plan_prices, public.feature_flags to anon;
--> statement-breakpoint

-- ——— تفعيل RLS على كل الجداول: ما لا سياسة له ممنوع افتراضياً ———

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;
--> statement-breakpoint

-- ——— السياسات ———
-- الأسماء: <الجدول>_<العملية>_<من>

-- الهوية
create policy users_select on public.users for select to authenticated
  using (id = auth.uid() or app.is_operations() or app.is_finance());
--> statement-breakpoint
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
--> statement-breakpoint
create policy users_update_admin on public.users for update to authenticated
  using (app.has_role('super_admin')) with check (app.has_role('super_admin'));
--> statement-breakpoint
create policy roles_select on public.roles for select to authenticated using (true);
--> statement-breakpoint
create policy permissions_select on public.permissions for select to authenticated using (true);
--> statement-breakpoint
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
--> statement-breakpoint
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or app.has_role('super_admin'));
--> statement-breakpoint
create policy user_roles_admin on public.user_roles for all to authenticated
  using (app.has_role('super_admin')) with check (app.has_role('super_admin'));
--> statement-breakpoint
create policy guardians_select on public.guardians for select to authenticated
  using (user_id = auth.uid() or app.is_operations() or app.is_finance());
--> statement-breakpoint
create policy students_select on public.students for select to authenticated
  using (app.can_read_student(id));
--> statement-breakpoint
-- ولي الأمر يعدّل ملفات أبنائه، والمشرفة تعدّل الإسناد؛ الحقول المسموحة يحددها الخادم
create policy students_update on public.students for update to authenticated
  using (app.is_guardian_of(id) or app.is_academic())
  with check (app.is_guardian_of(id) or app.is_academic());
--> statement-breakpoint
create policy guardian_students_select on public.guardian_students for select to authenticated
  using (guardian_id = app.my_guardian_id() or app.can_read_student(student_id));
--> statement-breakpoint
create policy consents_select on public.consents for select to authenticated
  using (user_id = auth.uid() or app.has_any_role(array['support', 'super_admin']::public.role_key[]));
--> statement-breakpoint
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid() and (student_id is null or app.is_guardian_of(student_id)));
--> statement-breakpoint
create policy login_attempts_select on public.login_attempts for select to authenticated
  using (app.has_role('super_admin'));
--> statement-breakpoint
-- otp_challenges: لا سياسة — للنظام وحده

-- المعلمات
create policy teachers_select on public.teachers for select to authenticated
  using ((status = 'active' and deleted_at is null) or user_id = auth.uid() or app.is_operations());
--> statement-breakpoint
create policy teachers_update on public.teachers for update to authenticated
  using (user_id = auth.uid() or app.is_academic()) with check (user_id = auth.uid() or app.is_academic());
--> statement-breakpoint
create policy teacher_applications_select on public.teacher_applications for select to authenticated
  using (user_id = auth.uid() or app.is_academic());
--> statement-breakpoint
create policy teacher_applications_insert on public.teacher_applications for insert to authenticated
  with check (user_id = auth.uid() and status = 'new');
--> statement-breakpoint
create policy teacher_applications_update on public.teacher_applications for update to authenticated
  using (app.is_academic()) with check (app.is_academic());
--> statement-breakpoint
-- مستندات الهوية والإجازة: صاحبة الطلب والمشرفة والمدير العام فقط
create policy teacher_documents_select on public.teacher_documents for select to authenticated
  using (app.is_academic() or exists (select 1 from public.teacher_applications a where a.id = application_id and a.user_id = auth.uid()));
--> statement-breakpoint
create policy teacher_documents_insert on public.teacher_documents for insert to authenticated
  with check (exists (select 1 from public.teacher_applications a where a.id = application_id and a.user_id = auth.uid() and a.status in ('new', 'needs_info')));
--> statement-breakpoint
create policy teacher_availability_select on public.teacher_availability for select to authenticated using (true);
--> statement-breakpoint
create policy teacher_availability_write on public.teacher_availability for all to authenticated
  using (teacher_id = app.my_teacher_id() or app.is_academic())
  with check (teacher_id = app.my_teacher_id() or app.is_academic());
--> statement-breakpoint
create policy teacher_time_off_select on public.teacher_time_off for select to authenticated
  using (teacher_id = app.my_teacher_id() or app.is_operations());
--> statement-breakpoint
create policy teacher_time_off_write on public.teacher_time_off for all to authenticated
  using (teacher_id = app.my_teacher_id() or app.is_academic())
  with check (teacher_id = app.my_teacher_id() or app.is_academic());
--> statement-breakpoint
create policy teacher_ratings_select on public.teacher_ratings for select to authenticated
  using (guardian_id = app.my_guardian_id() or teacher_id = app.my_teacher_id() or app.is_academic());
--> statement-breakpoint
create policy teacher_ratings_insert on public.teacher_ratings for insert to authenticated
  with check (
    guardian_id = app.my_guardian_id()
    and exists (
      select 1 from public.guardian_students gs join public.students st on st.id = gs.student_id
      where gs.guardian_id = app.my_guardian_id() and st.teacher_id = teacher_ratings.teacher_id
    )
  );
--> statement-breakpoint
create policy teacher_discipline_select on public.teacher_discipline_events for select to authenticated
  using (teacher_id = app.my_teacher_id() or app.is_academic());
--> statement-breakpoint
create policy files_select on public.files for select to authenticated
  using (
    owner_id = auth.uid()
    or (kind = 'receipt' and app.is_finance())
    or (kind in ('id_document', 'ijazah', 'certificate', 'recording') and app.is_academic())
  );
--> statement-breakpoint
create policy files_insert on public.files for insert to authenticated with check (owner_id = auth.uid());
--> statement-breakpoint

-- الباقات والدفع
create policy plans_select on public.plans for select to anon, authenticated using (active or app.is_finance());
--> statement-breakpoint
create policy plans_write on public.plans for all to authenticated using (app.is_finance()) with check (app.is_finance());
--> statement-breakpoint
create policy plan_prices_select on public.plan_prices for select to anon, authenticated using (active or app.is_finance());
--> statement-breakpoint
create policy plan_prices_write on public.plan_prices for all to authenticated using (app.is_finance()) with check (app.is_finance());
--> statement-breakpoint
create policy payment_accounts_select on public.payment_accounts for select to authenticated using (active or app.is_finance());
--> statement-breakpoint
create policy payment_accounts_write on public.payment_accounts for all to authenticated using (app.is_finance()) with check (app.is_finance());
--> statement-breakpoint
create policy coupons_select on public.coupons for select to authenticated using (app.is_finance());
--> statement-breakpoint
create policy coupons_write on public.coupons for all to authenticated using (app.is_finance()) with check (app.is_finance());
--> statement-breakpoint
create policy orders_select on public.orders for select to authenticated
  using (guardian_id = app.my_guardian_id() or app.is_finance() or app.has_role('support'));
--> statement-breakpoint
create policy order_items_select on public.order_items for select to authenticated
  using (app.owns_order(order_id) or app.is_finance() or app.has_role('support'));
--> statement-breakpoint
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (app.can_read_student(student_id) or app.is_finance());
--> statement-breakpoint
create policy payments_select on public.payments for select to authenticated
  using (app.owns_order(order_id) or app.is_finance());
--> statement-breakpoint
create policy payment_receipts_select on public.payment_receipts for select to authenticated
  using (app.is_finance() or exists (select 1 from public.payments p where p.id = payment_id and app.owns_order(p.order_id)));
--> statement-breakpoint
create policy payment_receipts_insert on public.payment_receipts for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.payments p
      where p.id = payment_id and app.owns_order(p.order_id) and p.status in ('awaiting_transfer', 'needs_fix')
    )
  );
--> statement-breakpoint
create policy refunds_select on public.refunds for select to authenticated
  using (app.is_finance() or exists (select 1 from public.payments p where p.id = payment_id and app.owns_order(p.order_id)));
--> statement-breakpoint
create policy coupon_redemptions_select on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid() or app.is_finance());
--> statement-breakpoint

-- الجدولة
create policy recurring_slots_select on public.recurring_slots for select to authenticated
  using (app.can_read_student(student_id) or teacher_id = app.my_teacher_id());
--> statement-breakpoint
create policy sessions_select on public.sessions for select to authenticated
  using (teacher_id = app.my_teacher_id() or app.can_read_student(student_id));
--> statement-breakpoint
create policy session_attendance_select on public.session_attendance for select to authenticated
  using (app.can_read_session(session_id));
--> statement-breakpoint
create policy session_attendance_insert on public.session_attendance for insert to authenticated
  with check (user_id = auth.uid() and app.can_read_session(session_id));
--> statement-breakpoint
create policy reschedule_requests_select on public.reschedule_requests for select to authenticated
  using (app.can_read_session(session_id));
--> statement-breakpoint
create policy reschedule_requests_insert on public.reschedule_requests for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending' and app.can_read_session(session_id));
--> statement-breakpoint
create policy meetings_select on public.meetings for select to authenticated
  using (app.can_read_session(session_id));
--> statement-breakpoint

-- الحفظ
create policy quran_surahs_select on public.quran_surahs for select to anon, authenticated using (true);
--> statement-breakpoint
create policy quran_ayahs_select on public.quran_ayahs for select to anon, authenticated using (true);
--> statement-breakpoint
create policy session_reports_select on public.session_reports for select to authenticated
  using (app.can_read_student(student_id));
--> statement-breakpoint
-- التقرير تكتبه المعلمة المسندة للحصة، وتعدّله هي أو المشرفة
create policy session_reports_insert on public.session_reports for insert to authenticated
  with check (teacher_id = app.my_teacher_id());
--> statement-breakpoint
create policy session_reports_update on public.session_reports for update to authenticated
  using (teacher_id = app.my_teacher_id() or app.is_academic())
  with check (teacher_id = app.my_teacher_id() or app.is_academic());
--> statement-breakpoint
create policy report_internal_notes_select on public.report_internal_notes for select to authenticated
  using (app.writes_report(report_id));
--> statement-breakpoint
create policy report_internal_notes_write on public.report_internal_notes for all to authenticated
  using (app.writes_report(report_id)) with check (app.writes_report(report_id) and author_id = auth.uid());
--> statement-breakpoint
create policy report_segments_select on public.report_segments for select to authenticated
  using (app.can_read_report(report_id));
--> statement-breakpoint
create policy report_segments_write on public.report_segments for all to authenticated
  using (app.writes_report(report_id)) with check (app.writes_report(report_id));
--> statement-breakpoint
create policy segment_mistakes_select on public.segment_mistakes for select to authenticated
  using (exists (select 1 from public.report_segments rs where rs.id = segment_id and app.can_read_report(rs.report_id)));
--> statement-breakpoint
create policy segment_mistakes_write on public.segment_mistakes for all to authenticated
  using (exists (select 1 from public.report_segments rs where rs.id = segment_id and app.writes_report(rs.report_id)))
  with check (exists (select 1 from public.report_segments rs where rs.id = segment_id and app.writes_report(rs.report_id)));
--> statement-breakpoint
create policy memorization_plans_select on public.memorization_plans for select to authenticated
  using (app.can_read_student(student_id));
--> statement-breakpoint
-- خطة الحفظ تحددها المشرفة أو المعلمة المسندة
create policy memorization_plans_write on public.memorization_plans for all to authenticated
  using (app.is_academic() or exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher_id()))
  with check (app.is_academic() or exists (select 1 from public.students s where s.id = student_id and s.teacher_id = app.my_teacher_id()));
--> statement-breakpoint
create policy review_schedule_select on public.review_schedule for select to authenticated
  using (app.can_read_student(student_id));
--> statement-breakpoint
create policy memorized_ranges_select on public.memorized_ranges for select to authenticated
  using (app.can_read_student(student_id));
--> statement-breakpoint

-- المحتوى
create policy tafsir_sources_select on public.tafsir_sources for select to anon, authenticated using (true);
--> statement-breakpoint
create policy tafsir_entries_select on public.tafsir_entries for select to anon, authenticated using (true);
--> statement-breakpoint
create policy azkar_select on public.azkar for select to anon, authenticated using (published or app.is_academic());
--> statement-breakpoint
create policy azkar_write on public.azkar for all to authenticated using (app.is_academic()) with check (app.is_academic());
--> statement-breakpoint
create policy daily_wird_select on public.daily_wird for select to anon, authenticated using (true);
--> statement-breakpoint
create policy daily_wird_write on public.daily_wird for all to authenticated using (app.is_academic()) with check (app.is_academic());
--> statement-breakpoint
create policy bookmarks_own on public.bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
--> statement-breakpoint
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
--> statement-breakpoint

-- النظام
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
--> statement-breakpoint
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
--> statement-breakpoint
create policy notification_templates_select on public.notification_templates for select to authenticated
  using (app.has_role('super_admin'));
--> statement-breakpoint
create policy notification_templates_write on public.notification_templates for all to authenticated
  using (app.has_role('super_admin')) with check (app.has_role('super_admin'));
--> statement-breakpoint
create policy audit_logs_select on public.audit_logs for select to authenticated using (app.has_role('super_admin'));
--> statement-breakpoint
create policy settings_select on public.settings for select to authenticated using (true);
--> statement-breakpoint
create policy settings_write on public.settings for all to authenticated
  using (app.has_role('super_admin')) with check (app.has_role('super_admin'));
--> statement-breakpoint
create policy feature_flags_select on public.feature_flags for select to anon, authenticated using (true);
--> statement-breakpoint
create policy feature_flags_write on public.feature_flags for all to authenticated
  using (app.has_role('super_admin')) with check (app.has_role('super_admin'));
--> statement-breakpoint
create policy jobs_select on public.jobs for select to authenticated using (app.has_role('super_admin'));
