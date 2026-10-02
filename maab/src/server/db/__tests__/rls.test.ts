/*
 * اختبارات طبقة قاعدة البيانات (القسم 17): سياسات RLS، ومنع التعارض حتى مع
 * الطلبات المتزامنة، والرصيد، وعدم قابلية تعديل الدفع وسجل التدقيق، وقواعد القبول.
 * تعمل على قاعدة اختبار محلية تُبنى من الصفر: TEST_DATABASE_URL.
 */
import { execFileSync } from 'node:child_process';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_URL = process.env.TEST_DATABASE_URL;

/** Drizzle يغلّف خطأ Postgres؛ نطابق رسالته الأصلية واسم القيد */
async function rejects(p: Promise<unknown>, pattern: RegExp) {
  try {
    await p;
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string; constraint_name?: string } };
    expect([err.message, err.cause?.message, err.cause?.constraint_name].join(' | ')).toMatch(pattern);
    return;
  }
  throw new Error(`كان متوقعاً أن يُرفض الطلب بخطأ يطابق ${pattern}`);
}

describe.skipIf(!TEST_URL)('قاعدة البيانات: الصلاحيات والقيود', () => {
  let c: typeof import('../client');
  let t: typeof import('../schema');
  const user: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL;
    execFileSync('npx', ['tsx', 'scripts/db/reset-local.ts', '--demo'], { env: { ...process.env, DATABASE_URL: TEST_URL }, stdio: 'pipe' });
    c = await import('../client');
    t = await import('../schema');
    const rows = await c.getDb().select({ id: t.users.id, phone: t.users.phone }).from(t.users);
    const byPhone = Object.fromEntries(rows.map((r) => [r.phone, r.id]));
    Object.assign(user, {
      salma: byPhone['+966512345678'],
      mazahir: byPhone['+249911000101'],
      heba: byPhone['+966500000102'],
      malaz: byPhone['+249912000201'],
      supervisor: byPhone['+966500000901'],
      finance: byPhone['+966500000902'],
      support: byPhone['+249911000903'],
      admin: byPhone['+966500000900'],
    });
  }, 120_000);

  afterAll(async () => {
    await c?.closeDb();
  });

  const names = async (uid: string) =>
    (await c.asUser(uid, (tx) => tx.select({ n: t.students.displayName }).from(t.students))).map((r) => r.n).sort();

  // —— من يرى من ——

  it('ولية الأمر ترى أبناءها فقط', async () => {
    expect(await names(user.salma)).toEqual(['رؤى', 'محمد']);
  });

  it('المعلمة ترى طلابها المسندين إليها فقط', async () => {
    expect(await names(user.heba)).toEqual(['محمد']);
    const mz = await names(user.mazahir);
    expect(mz).toContain('رؤى');
    expect(mz).not.toContain('محمد');
  });

  it('الطالبة البالغة ترى ملفها، والمشرفة والدعم يرون الكل، والمالية لا ترى ملفات الطلاب', async () => {
    expect(await names(user.malaz)).toEqual(['ملاذ']);
    expect(await names(user.supervisor)).toHaveLength(7);
    expect(await names(user.support)).toHaveLength(7);
    expect(await names(user.finance)).toEqual([]);
    // واسم الطالب وحده متاح للمالية عبر الدالة المخصّصة
    const [{ id }] = await c.getDb().select({ id: t.students.id }).from(t.students).where(eq(t.students.displayName, 'محمد'));
    const r = await c.asUser(user.finance, (tx) => tx.execute(sql`select app.student_name(${id}) as n`));
    expect(r[0].n).toBe('محمد عمر الطيب');
  });

  it('الطلبات والتحويلات: كل ولي أمر يرى طلباته، والمالية ترى الكل، والدعم لا يرى المستندات المالية', async () => {
    const mine = await c.asUser(user.salma, (tx) => tx.select({ ref: t.orders.ref }).from(t.orders));
    expect(mine.map((r) => r.ref).sort()).toEqual(['MAAB-2026-000085', 'MAAB-2026-000097', 'MAAB-2026-000148']);
    const pays = await c.asUser(user.salma, (tx) => tx.select().from(t.payments));
    expect(pays).toHaveLength(3);
    expect(await c.asUser(user.finance, (tx) => tx.select().from(t.payments))).toHaveLength(8);
    expect(await c.asUser(user.support, (tx) => tx.select().from(t.payments))).toHaveLength(0);
  });

  it('الوصول المباشر بمعرّف طالب أسرة أخرى لا يُرجع شيئاً (IDOR)', async () => {
    const [{ id }] = await c.getDb().select({ id: t.students.id }).from(t.students).where(eq(t.students.displayName, 'هديل'));
    const rows = await c.asUser(user.salma, (tx) => tx.select().from(t.students).where(eq(t.students.id, id)));
    expect(rows).toEqual([]);
    await rejects(
      c.asUser(user.salma, (tx) => tx.insert(t.consents).values({ userId: user.salma, studentId: id, kind: 'minor_data', version: 'x' })),
      /row-level security/,
    );
    const reports = await c.asUser(user.salma, (tx) => tx.select().from(t.sessionReports).where(eq(t.sessionReports.studentId, id)));
    expect(reports).toEqual([]);
  });

  it('الملاحظة الداخلية تراها المعلمة الكاتبة والمشرفة، لا ولية الأمر', async () => {
    expect(await c.asUser(user.salma, (tx) => tx.select().from(t.reportInternalNotes))).toHaveLength(0);
    expect(await c.asUser(user.mazahir, (tx) => tx.select().from(t.reportInternalNotes))).toHaveLength(1);
    expect(await c.asUser(user.supervisor, (tx) => tx.select().from(t.reportInternalNotes))).toHaveLength(1);
    expect(await c.asUser(user.salma, (tx) => tx.select().from(t.sessionReports))).toHaveLength(5);
  });

  it('مستندات الهوية لا تراها المالية، والإيصالات لا يراها الدعم', async () => {
    const [{ id: fileId }] = await c.asSystem(null, (tx) =>
      tx.insert(t.files).values({ ownerId: user.malaz, kind: 'id_document', bucket: 'teacher-docs', path: `x/${Date.now()}.pdf`, mime: 'application/pdf', sizeBytes: 1000, sha256: 'x' }).returning({ id: t.files.id }),
    );
    const see = (uid: string) => c.asUser(uid, (tx) => tx.select().from(t.files).where(eq(t.files.id, fileId)));
    expect(await see(user.finance)).toHaveLength(0);
    expect(await see(user.supervisor)).toHaveLength(1);
    expect(await see(user.malaz)).toHaveLength(1);
    const receipts = await c.asUser(user.support, (tx) => tx.select().from(t.files).where(eq(t.files.kind, 'receipt')));
    expect(receipts).toHaveLength(0);
  });

  it('الزائر يقرأ المصحف ولا يرى الحسابات', async () => {
    const ayahs = await c.asAnon((tx) => tx.select().from(t.quranAyahs).where(eq(t.quranAyahs.id, 1)));
    expect(ayahs[0].text).toContain('بِسْمِ');
    await rejects(c.asAnon((tx) => tx.select().from(t.users)), /permission denied/);
  });

  // —— الجدولة ——

  async function teacherAndStudent() {
    const db = c.getDb();
    const [te] = await db.select().from(t.teachers).where(eq(t.teachers.displayName, 'أ. أسماء النور'));
    const [st] = await db.select().from(t.students).where(eq(t.students.displayName, 'إسراء'));
    const [st2] = await db.select().from(t.students).where(eq(t.students.displayName, 'ملاذ'));
    return { te, st, st2 };
  }
  const base = new Date('2030-01-06T15:00:00Z');
  const plus = (min: number) => new Date(base.getTime() + min * 60_000);

  it('منع التعارض بفاصل 5 دقائق في قاعدة البيانات', async () => {
    const { te, st, st2 } = await teacherAndStudent();
    const insert = (studentId: string, start: number, len: number) =>
      c.asSystem(null, (tx) =>
        tx.insert(t.sessions).values({ teacherId: te.id, studentId, startsAt: plus(start), endsAt: plus(start + len), blockedUntil: plus(0) }),
      );
    await insert(st.id, 0, 45);
    // تبدأ بعد 4 دقائق من نهاية الأولى ← تعارض
    await rejects(insert(st2.id, 49, 30), /sessions_teacher_no_overlap/);
    // وبعد 5 دقائق ← مسموح
    await expect(insert(st2.id, 50, 30)).resolves.toBeDefined();
    // والطالب نفسه لا يُحجز له موعدان متداخلان ولو مع معلمتين
    const [other] = await c.getDb().select().from(t.teachers).where(eq(t.teachers.displayName, 'أ. مزاهر عبدالرحيم'));
    await rejects(
      c.asSystem(null, (tx) => tx.insert(t.sessions).values({ teacherId: other.id, studentId: st.id, startsAt: plus(10), endsAt: plus(40), blockedUntil: plus(0) })),
      /sessions_student_no_overlap/,
    );
  });

  it('طلبا حجز متزامنان على الوقت نفسه: ينجح واحد فقط', async () => {
    const { te, st, st2 } = await teacherAndStudent();
    const at = (m: number) => new Date(base.getTime() + (24 * 60 + m) * 60_000);
    const attempt = (studentId: string) =>
      c.asSystem(null, async (tx) => {
        await tx.insert(t.sessions).values({ teacherId: te.id, studentId, startsAt: at(0), endsAt: at(45), blockedUntil: at(0) });
        await tx.execute(sql`select pg_sleep(0.2)`);
      });
    const results = await Promise.allSettled([attempt(st.id), attempt(st2.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('الرصيد يُخصم مع تغيير حالة الحصة ولا ينزل تحت الصفر، والتعويضية لا تُخصم', async () => {
    const db = c.getDb();
    const [sub] = await db.select().from(t.subscriptions).where(eq(t.subscriptions.sessionsRemaining, 1));
    const upcoming = await db.select().from(t.sessions).where(sql`${t.sessions.subscriptionId} = ${sub.id} and ${t.sessions.status} = 'scheduled'`);
    expect(upcoming.length).toBeGreaterThan(0);
    const setStatus = (id: string, status: 'completed' | 'excused' | 'scheduled') =>
      c.asSystem(null, (tx) => tx.update(t.sessions).set({ status }).where(eq(t.sessions.id, id)));
    await setStatus(upcoming[0].id, 'completed');
    expect((await db.select().from(t.subscriptions).where(eq(t.subscriptions.id, sub.id)))[0].sessionsRemaining).toBe(0);
    // حصة أخرى في رصيد صفر ← يرفضها قيد CHECK وتُلغى المعاملة كاملة
    const [extra] = await c.asSystem(null, (tx) =>
      tx.insert(t.sessions).values({ subscriptionId: sub.id, teacherId: upcoming[0].teacherId, studentId: sub.studentId, startsAt: plus(5000), endsAt: plus(5030), blockedUntil: plus(0) }).returning(),
    );
    await rejects(setStatus(extra.id, 'completed'), /subscriptions_remaining_ck/);
    expect((await db.select().from(t.sessions).where(eq(t.sessions.id, extra.id)))[0].status).toBe('scheduled');
    // تصحيح الحالة إلى «غياب بعذر» يعيد الحصة إلى الرصيد
    await setStatus(upcoming[0].id, 'excused');
    expect((await db.select().from(t.subscriptions).where(eq(t.subscriptions.id, sub.id)))[0].sessionsRemaining).toBe(1);
  });

  // —— السجلات غير القابلة للتعديل ——

  it('الدفع لا يعدّله إلا النظام، ولا يتغير مبلغه، ولا يُحذف', async () => {
    const [p] = await c.getDb().select().from(t.payments).where(eq(t.payments.status, 'under_review'));
    // المالية بدورها العادي لا تملك سياسة تعديل: لا يتغير شيء
    const touched = await c.asUser(user.finance, (tx) => tx.update(t.payments).set({ status: 'approved' }).where(eq(t.payments.id, p.id)).returning());
    expect(touched).toEqual([]);
    // ولو تجاوزت RLS بدور المالك نفسه، يمنعها المشغّل لأنها ليست دور النظام
    await rejects(c.getDb().update(t.payments).set({ status: 'approved' }).where(eq(t.payments.id, p.id)), /system role/);
    await rejects(c.asSystem(user.finance, (tx) => tx.update(t.payments).set({ amount: 1 }).where(eq(t.payments.id, p.id))), /immutable/);
    await rejects(c.asSystem(user.finance, (tx) => tx.delete(t.payments).where(eq(t.payments.id, p.id))), /append-only/);
    await expect(
      c.asSystem(user.finance, (tx) => tx.update(t.payments).set({ status: 'needs_fix', reason: 'المبلغ غير مطابق' }).where(eq(t.payments.id, p.id))),
    ).resolves.toBeDefined();
    // الرفض أو التصحيح بلا سبب يرفضه القيد
    await rejects(
      c.asSystem(user.finance, (tx) => tx.update(t.payments).set({ status: 'rejected', reason: null }).where(eq(t.payments.id, p.id))),
      /payments_reason_ck/,
    );
  });

  it('سجل التدقيق لا يُعدَّل ولا يُحذف', async () => {
    await rejects(c.asSystem(null, (tx) => tx.update(t.auditLogs).set({ action: 'x' })), /append-only/);
    await rejects(c.asSystem(null, (tx) => tx.delete(t.auditLogs)), /append-only/);
  });

  // —— القبول والإسناد ——

  it('الأولاد حتى 12 سنة، والمعلمة المسندة تدرّس فئة الطالب', async () => {
    const born = (years: number) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - years, d.getMonth(), d.getDate() - 10);
      return d.toISOString().slice(0, 10);
    };
    const add = (gender: 'male' | 'female', years: number, teacherId?: string) =>
      c.asSystem(null, (tx) => tx.insert(t.students).values({ fullName: 'اختبار', displayName: 'اختبار', gender, birthDate: born(years), teacherId }));
    await expect(add('male', 12)).resolves.toBeDefined();
    await rejects(add('male', 13), /boy_too_old/);
    await rejects(add('female', 3), /student_too_young/);
    const [heba] = await c.getDb().select().from(t.teachers).where(eq(t.teachers.displayName, 'أ. هبة الأمين'));
    await rejects(add('female', 28, heba.id), /teacher_category_mismatch/);
    await expect(add('female', 9, heba.id)).resolves.toBeDefined();
  });

  it('لا تكتب المعلمة تقريراً لحصة ليست لها', async () => {
    const [heba] = await c.getDb().select().from(t.teachers).where(eq(t.teachers.displayName, 'أ. هبة الأمين'));
    const [roaSession] = await c
      .getDb()
      .select()
      .from(t.sessions)
      .innerJoin(t.students, eq(t.students.id, t.sessions.studentId))
      .where(sql`${t.students.displayName} = 'رؤى' and ${t.sessions.status} = 'scheduled'`);
    await rejects(
      c.asUser(user.heba, (tx) =>
        tx.insert(t.sessionReports).values({ sessionId: roaSession.sessions.id, teacherId: heba.id, studentId: roaSession.sessions.studentId, attendance: 'present' }),
      ),
      /report_session_mismatch/,
    );
  });

  it('الرقم المرجعي فريد ومتسلسل حتى مع الطلبات المتزامنة', async () => {
    const refs = await Promise.all(Array.from({ length: 12 }, () => c.asSystem(null, (tx) => tx.execute(sql`select app.next_order_ref(2031::smallint) as ref`))));
    const values = refs.map((r) => r[0].ref as string).sort();
    expect(new Set(values).size).toBe(12);
    expect(values[0]).toBe('MAAB-2031-000001');
    expect(values[11]).toBe('MAAB-2031-000012');
    await rejects(c.asUser(user.salma, (tx) => tx.execute(sql`select app.next_order_ref()`)), /permission denied/);
  });
});
