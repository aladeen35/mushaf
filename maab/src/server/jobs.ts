// مهام الخلفية (القسم 13): كل مهمة دالة تعمل في معاملة واحدة وتُختبر وحدها،
// والعامل (src/worker) يجدولها بـpg-boss. الأحداث تُكتب في القاعدة أولاً
// (روابط معلّقة، إشعارات في الطابور) فلا يضيع شيء إن توقف العامل.
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { asSystem } from './db/client';
import { guardians, guardianStudents, idempotencyKeys, notifications, otpChallenges, sessions, students, teachers, users } from './db/schema';
import { expireOrders, expireSubscriptions } from './services/billing';
import { processPendingMeetings } from './services/meetings';
import { dispatchQueued, notify } from './services/notifications';
import { lateReports } from './services/reports';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** الروابط والإشعارات المعلّقة — كل دقيقة */
export const outbox = () =>
  asSystem(null, async (tx) => ({ meetings: await processPendingMeetings(tx), notifications: await dispatchQueued(tx) }));

const alreadySent = (event: string, sessionId: string) =>
  sql`exists (select 1 from ${notifications} n where n.event = ${event} and n.data->>'sessionId' = ${sessionId})`;

/** تذكير قبل الحصة بيوم وبساعة، بتوقيت كل مستلم — كل 5 دقائق */
export function reminders(now = new Date()) {
  return asSystem(null, async (tx) => {
    let sent = 0;
    for (const [event, lead] of [['session_reminder_24h', 24 * HOUR], ['session_reminder_1h', HOUR]] as const) {
      const due = await tx
        .select({ id: sessions.id, startsAt: sessions.startsAt, studentId: sessions.studentId, student: students.displayName, studentUser: students.userId, teacher: teachers.displayName, teacherUser: teachers.userId })
        .from(sessions)
        .innerJoin(students, eq(students.id, sessions.studentId))
        .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
        .where(and(eq(sessions.status, 'scheduled'), gte(sessions.startsAt, new Date(now.getTime() + lead - 10 * MIN)), lt(sessions.startsAt, new Date(now.getTime() + lead + 10 * MIN))));
      for (const s of due) {
        const [{ done }] = (await tx.execute(sql`select ${alreadySent(event, s.id)} as done`)) as unknown as { done: boolean }[];
        if (done) continue;
        const family = await tx
          .select({ userId: guardians.userId, tz: users.timezone })
          .from(guardianStudents)
          .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
          .innerJoin(users, eq(users.id, guardians.userId))
          .where(eq(guardianStudents.studentId, s.studentId));
        const people = [...family, ...(s.studentUser ? [{ userId: s.studentUser, tz: family[0]?.tz ?? 'Asia/Riyadh' }] : [])];
        const [t] = await tx.select({ tz: users.timezone }).from(users).where(eq(users.id, s.teacherUser));
        people.push({ userId: s.teacherUser, tz: t?.tz ?? 'Asia/Riyadh' });
        for (const p of people) {
          const time = new Intl.DateTimeFormat('ar', { timeZone: p.tz, hour: 'numeric', minute: '2-digit' }).format(s.startsAt);
          await notify(tx, { userIds: [p.userId], event, vars: { student: s.student, teacher: s.teacher, time }, data: { sessionId: s.id } });
        }
        sent++;
      }
    }
    return { sent };
  });
}

/** الطلبات غير المدفوعة بعد 72 ساعة — كل 10 دقائق */
export const ordersExpire = (now = new Date()) => asSystem(null, (tx) => expireOrders(tx, now));

/** الاشتراكات المنتهية — كل ساعة */
export const subscriptionsExpire = (now = new Date()) => asSystem(null, (tx) => expireSubscriptions(tx, now));

/** تذكير المعلمة بالتقرير المتأخر مرة واحدة لكل حصة — كل ساعة */
export function reportsLate(now = new Date()) {
  return asSystem(null, async (tx) => {
    const late = await lateReports(tx, now);
    let reminded = 0;
    for (const r of late) {
      const [{ done }] = (await tx.execute(sql`select ${alreadySent('report_late', r.sessionId)} as done`)) as unknown as { done: boolean }[];
      if (done) continue;
      await tx.insert(notifications).values({
        userId: r.teacherUser,
        event: 'report_late',
        channel: 'in_app',
        title: 'تقرير متأخر',
        body: 'انتهت مهلة كتابة تقرير حصة، اكتبيه الآن ليصل لولي الأمر.',
        data: { sessionId: r.sessionId },
        status: 'sent',
        sentAt: now,
      });
      reminded++;
    }
    return { late: late.length, reminded };
  });
}

/** تنظيف يومي: مفاتيح منع التكرار وتحديات الدخول القديمة */
export function cleanup(now = new Date()) {
  return asSystem(null, async (tx) => {
    const keys = await tx.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, new Date(now.getTime() - 24 * HOUR))).returning({ k: idempotencyKeys.key });
    const otps = await tx.delete(otpChallenges).where(lt(otpChallenges.createdAt, new Date(now.getTime() - 24 * HOUR))).returning({ id: otpChallenges.id });
    return { idempotencyKeys: keys.length, otpChallenges: otps.length };
  });
}

export const JOBS = {
  outbox: { cron: '* * * * *', run: () => outbox() },
  reminders: { cron: '*/5 * * * *', run: () => reminders() },
  'orders.expire': { cron: '*/10 * * * *', run: () => ordersExpire() },
  'subscriptions.expire': { cron: '7 * * * *', run: () => subscriptionsExpire() },
  'reports.late': { cron: '17 * * * *', run: () => reportsLate() },
  cleanup: { cron: '33 3 * * *', run: () => cleanup() },
} as const;
