// الجدولة (القسم 7): البحث في أوقات المعلمة بتوقيت ولي الأمر، وتوليد حصص
// الباقة من المواعيد الأسبوعية، والإلغاء وإعادة الجدولة ونافذة الدخول.
// قيد EXCLUDE في القاعدة هو الحَكَم الأخير ضد التعارض حتى مع التزامن؛ الفحص
// هنا ليعطي رسالة واضحة قبل الوصول إليه.
import { and, asc, desc, eq, gt, gte, lt, ne, sql } from 'drizzle-orm';
import { can } from '@/lib/domain/permissions';
import { hoursUntil, joinState } from '@/lib/domain/sessions';
import { addDays, fromMinutes, localParts, toMinutes, weekdayOf, zonedToUtc } from '@/lib/tz';
import { asSystem, asUser, type Tx } from '../db/client';
import {
  guardians,
  guardianStudents,
  meetings,
  rescheduleRequests,
  sessionAttendance,
  sessionReports,
  sessions,
  students,
  subscriptions,
  teacherAvailability,
  teachers,
  teacherTimeOff,
} from '../db/schema';
import { ApiError, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { audit } from './audit';
import { requestMeetings } from './meetings';
import { notify } from './notifications';
import { getSettings } from './settings';

const MIN = 60_000;
const DAY = 86_400_000;
/** أقرب موعد يمكن حجزه من الآن */
export const MIN_LEAD_HOURS = 3;
const STEP_MIN = 15;

export type WeeklySlot = { weekday: number; time: string };
type Interval = { start: number; end: number };

export type TeacherCalendar = {
  teacher: typeof teachers.$inferSelect;
  windows: (typeof teacherAvailability.$inferSelect)[];
  timeOff: (typeof teacherTimeOff.$inferSelect)[];
  busy: Interval[];
  buffer: number;
};

export async function teacherCalendar(tx: Tx, teacherId: string, from: Date, to: Date, ignoreSessionId?: string): Promise<TeacherCalendar> {
  const [teacher] = await tx.select().from(teachers).where(eq(teachers.id, teacherId));
  if (!teacher || teacher.deletedAt || teacher.status !== 'active') throw notFound('المعلمة');
  const [windows, timeOff, busyRows, cfg] = await Promise.all([
    tx.select().from(teacherAvailability).where(eq(teacherAvailability.teacherId, teacherId)),
    tx.select().from(teacherTimeOff).where(eq(teacherTimeOff.teacherId, teacherId)),
    tx
      .select({ id: sessions.id, start: sessions.startsAt, end: sessions.blockedUntil })
      .from(sessions)
      .where(and(eq(sessions.teacherId, teacherId), ne(sessions.status, 'cancelled'), lt(sessions.startsAt, to), gt(sessions.blockedUntil, from))),
    getSettings(tx, ['session_buffer_minutes']),
  ]);
  return {
    teacher,
    windows,
    timeOff,
    busy: busyRows.filter((b) => b.id !== ignoreSessionId).map((b) => ({ start: b.start.getTime(), end: b.end.getTime() })),
    buffer: cfg.session_buffer_minutes,
  };
}

/** هل الموعد داخل إتاحة المعلمة بتوقيتها، وليس في إجازة؟ */
export function withinAvailability(cal: TeacherCalendar, start: Date, durationMin: number): boolean {
  const tz = cal.teacher.timezone;
  const s = localParts(start, tz);
  const e = localParts(new Date(start.getTime() + durationMin * MIN), tz);
  if (cal.timeOff.some((o) => s.date >= o.startsOn && s.date <= o.endsOn)) return false;
  // حصة تعبر منتصف الليل بتوقيت المعلمة لا تُقبل إلا إن انتهت عنده تماماً
  const endMin = e.date === s.date ? e.minutes : e.minutes === 0 ? 24 * 60 : -1;
  if (endMin < 0) return false;
  return cal.windows.some((w) => w.weekday === s.weekday && toMinutes(w.startTime) <= s.minutes && endMin <= toMinutes(w.endTime));
}

export function isFree(cal: TeacherCalendar, start: Date, durationMin: number): boolean {
  const a = start.getTime();
  const b = a + (durationMin + cal.buffer) * MIN;
  return !cal.busy.some((x) => a < x.end && x.start < b);
}

/** مواعيد أسبوعية متاحة بتوقيت ولي الأمر، حرّة في كل أسابيع الباقة */
export async function weeklyOptions(
  tx: Tx,
  q: { teacherId: string; durationMin: number; tz: string; weeks: number; now?: Date },
): Promise<{ weekday: number; time: string; firstStartsAt: string }[]> {
  const now = q.now ?? new Date();
  const earliest = now.getTime() + MIN_LEAD_HOURS * 3_600_000;
  const horizon = new Date(now.getTime() + (q.weeks + 1) * 7 * DAY);
  const cal = await teacherCalendar(tx, q.teacherId, now, horizon);
  const today = localParts(now, q.tz).date;
  const out: { weekday: number; time: string; firstStartsAt: string }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let m = 0; m + q.durationMin <= 24 * 60; m += STEP_MIN) {
      let date = addDays(today, d);
      let first = zonedToUtc(date, fromMinutes(m), q.tz);
      if (first.getTime() < earliest) {
        date = addDays(date, 7);
        first = zonedToUtc(date, fromMinutes(m), q.tz);
      }
      let ok = true;
      for (let w = 0; w < q.weeks && ok; w++) {
        const at = zonedToUtc(addDays(date, 7 * w), fromMinutes(m), q.tz);
        ok = withinAvailability(cal, at, q.durationMin) && isFree(cal, at, q.durationMin);
      }
      if (ok) out.push({ weekday: weekdayOf(date), time: fromMinutes(m), firstStartsAt: first.toISOString() });
    }
  }
  return out.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}

/** مواعيد مفردة (للتعويض وإعادة الجدولة) خلال أيام قادمة */
export async function singleOptions(
  tx: Tx,
  q: { teacherId: string; durationMin: number; tz: string; days: number; now?: Date; ignoreSessionId?: string },
): Promise<string[]> {
  const now = q.now ?? new Date();
  const earliest = now.getTime() + MIN_LEAD_HOURS * 3_600_000;
  const cal = await teacherCalendar(tx, q.teacherId, now, new Date(now.getTime() + (q.days + 1) * DAY), q.ignoreSessionId);
  const today = localParts(now, q.tz).date;
  const out: string[] = [];
  for (let d = 0; d <= q.days; d++) {
    for (let m = 0; m + q.durationMin <= 24 * 60; m += STEP_MIN) {
      const at = zonedToUtc(addDays(today, d), fromMinutes(m), q.tz);
      if (at.getTime() >= earliest && withinAvailability(cal, at, q.durationMin) && isFree(cal, at, q.durationMin)) out.push(at.toISOString());
    }
  }
  return out;
}

/** أول عدد من المواعيد الفعلية للباقة من مواعيد أسبوعية بتوقيت ولي الأمر */
export function planOccurrences(slots: WeeklySlot[], tz: string, count: number, now = new Date()): Date[] {
  const earliest = now.getTime() + MIN_LEAD_HOURS * 3_600_000;
  const today = localParts(now, tz).date;
  const out: Date[] = [];
  for (let d = 0; out.length < count && d < 7 * (count + 2); d++) {
    const date = addDays(today, d);
    const wd = weekdayOf(date);
    for (const s of slots.filter((x) => x.weekday === wd).sort((a, b) => a.time.localeCompare(b.time))) {
      const at = zonedToUtc(date, s.time, tz);
      if (at.getTime() >= earliest && out.length < count) out.push(at);
    }
  }
  return out;
}

// —— قراءة الحصص بهوية المستخدم (RLS) ——

export async function listSessions(viewer: Viewer, q: { from: Date; to: Date; studentId?: string }) {
  return asUser(viewer.userId, async (tx) => {
    const rows = await tx
      .select({
        id: sessions.id,
        startsAt: sessions.startsAt,
        endsAt: sessions.endsAt,
        status: sessions.status,
        isMakeup: sessions.isMakeup,
        studentId: sessions.studentId,
        student: students.displayName,
        teacherId: sessions.teacherId,
        teacher: teachers.displayName,
        reportId: sessionReports.id,
      })
      .from(sessions)
      .innerJoin(students, eq(students.id, sessions.studentId))
      .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
      .leftJoin(sessionReports, eq(sessionReports.sessionId, sessions.id))
      .where(and(gte(sessions.startsAt, q.from), lt(sessions.startsAt, q.to), q.studentId ? eq(sessions.studentId, q.studentId) : undefined))
      .orderBy(asc(sessions.startsAt));
    // رابط الحصة لا يُرسل في أي استجابة؛ يصل عبر /sessions/{id}/join فقط
    return rows.map((r) => ({ ...r, durationMin: Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / MIN) }));
  });
}

type Party = 'guardian' | 'student' | 'teacher' | 'staff' | null;

async function partyOf(tx: Tx, viewer: Viewer, s: typeof sessions.$inferSelect): Promise<Party> {
  const [t] = await tx.select({ userId: teachers.userId }).from(teachers).where(eq(teachers.id, s.teacherId));
  if (t?.userId === viewer.userId) return 'teacher';
  const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, s.studentId));
  if (st?.userId === viewer.userId) return 'student';
  const [g] = await tx
    .select({ id: guardians.id })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(and(eq(guardianStudents.studentId, s.studentId), eq(guardians.userId, viewer.userId)));
  if (g) return 'guardian';
  return can(viewer.roles, 'sessions.reschedule.any') ? 'staff' : null;
}

/** الحصة كما يراها المستخدم (RLS)، ثم صفته فيها */
async function loadForViewer(viewer: Viewer, sessionId: string) {
  const s = await asUser(viewer.userId, async (tx) => (await tx.select().from(sessions).where(eq(sessions.id, sessionId)))[0]);
  if (!s) throw notFound('الحصة');
  const party = await asSystem(viewer.userId, (tx) => partyOf(tx, viewer, s));
  return { s, party };
}

/** المستخدمون المعنيّون بالحصة: المعلمة وأولياء الأمر والطالبة البالغة */
async function sessionPeople(tx: Tx, s: typeof sessions.$inferSelect) {
  const rows = await tx
    .select({ teacherUser: teachers.userId, studentUser: students.userId, student: students.displayName, teacher: teachers.displayName })
    .from(sessions)
    .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
    .innerJoin(students, eq(students.id, sessions.studentId))
    .where(eq(sessions.id, s.id));
  const gs = await tx
    .select({ userId: guardians.userId })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(eq(guardianStudents.studentId, s.studentId));
  const r = rows[0];
  return {
    teacherUser: r.teacherUser,
    family: [...gs.map((g) => g.userId), ...(r.studentUser ? [r.studentUser] : [])],
    student: r.student,
    teacher: r.teacher,
  };
}

const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('ar', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(d);

export async function cancelSession(viewer: Viewer, sessionId: string, input: { reason: string; excused?: boolean }, ip?: string | null) {
  const { s, party } = await loadForViewer(viewer, sessionId);
  if (party !== 'guardian' && party !== 'student' && party !== 'staff') throw forbidden();
  if (s.status !== 'scheduled') throw conflict('not_cancellable', 'لا يمكن إلغاء هذه الحصة بحالتها الحالية');
  const now = new Date();
  if (s.startsAt <= now) throw conflict('already_started', 'بدأت الحصة، تواصلي مع الدعم');

  return asSystem(viewer.userId, async (tx) => {
    const cfg = await getSettings(tx, ['free_cancel_hours']);
    const inTime = hoursUntil(now, s.startsAt) >= cfg.free_cancel_hours;
    // الإلغاء في المهلة لا يُخصم ويُتاح موعد بديل؛ المتأخر يُسجَّل غياباً ويُخصم.
    // الإدارة وحدها تستثني بعذر.
    const status = inTime ? 'cancelled' : party === 'staff' && input.excused ? 'excused' : 'student_absent';
    const [after] = await tx
      .update(sessions)
      .set({ status, cancelReason: input.reason })
      .where(and(eq(sessions.id, s.id), eq(sessions.status, 'scheduled')))
      .returning();
    if (!after) throw conflict('not_cancellable', 'تغيّرت حالة الحصة، حدّثي الصفحة');
    if (status === 'cancelled') await requestMeetings(tx, [s.id]);
    const people = await sessionPeople(tx, s);
    await notify(tx, {
      userIds: [people.teacherUser, ...people.family].filter((u): u is string => Boolean(u) && u !== viewer.userId),
      event: 'session_changed',
      vars: { student: people.student, time: 'ملغاة' },
      data: { sessionId: s.id, status },
    });
    await audit(tx, viewer, { action: 'session.cancel', entity: 'sessions', entityId: s.id, before: { status: s.status }, after: { status }, reason: input.reason }, ip);
    return { id: s.id, status, deducted: status === 'student_absent', inFreeWindow: inTime };
  });
}

async function moveSession(tx: Tx, viewer: Viewer, s: typeof sessions.$inferSelect, startsAt: Date) {
  const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / MIN);
  const cal = await teacherCalendar(tx, s.teacherId, new Date(startsAt.getTime() - DAY), new Date(startsAt.getTime() + DAY), s.id);
  if (!withinAvailability(cal, startsAt, duration)) throw conflict('outside_availability', 'الموعد خارج أوقات إتاحة المعلمة');
  if (!isFree(cal, startsAt, duration)) throw conflict('slot_taken', 'هذا الوقت لم يعد متاحاً لدى المعلمة، اختاري وقتاً آخر');
  if (s.subscriptionId) {
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, s.subscriptionId));
    if (sub && startsAt > sub.expiresAt) throw conflict('after_expiry', 'الموعد بعد انتهاء صلاحية الباقة');
  }
  const [moved] = await tx
    .update(sessions)
    .set({ startsAt, endsAt: new Date(startsAt.getTime() + duration * MIN) })
    .where(eq(sessions.id, s.id))
    .returning();
  await requestMeetings(tx, [s.id]);
  const people = await sessionPeople(tx, s);
  for (const [userIds, tz] of [[[people.teacherUser], cal.teacher.timezone], [people.family, viewer.user.timezone]] as const) {
    await notify(tx, {
      userIds: userIds.filter((u): u is string => Boolean(u) && u !== viewer.userId),
      event: 'session_changed',
      vars: { student: people.student, time: fmtTime(startsAt, tz) },
      data: { sessionId: s.id },
    });
  }
  return moved;
}

export async function rescheduleSession(viewer: Viewer, sessionId: string, input: { startsAt: Date; reason: string }, ip?: string | null) {
  const { s, party } = await loadForViewer(viewer, sessionId);
  if (!party) throw forbidden();
  if (s.status !== 'scheduled') throw conflict('not_reschedulable', 'لا يمكن إعادة جدولة هذه الحصة بحالتها الحالية');
  const now = new Date();
  if (input.startsAt.getTime() < now.getTime() + MIN_LEAD_HOURS * 3_600_000) throw conflict('too_soon', `اختاري موعداً بعد ${MIN_LEAD_HOURS} ساعات على الأقل`);

  return asSystem(viewer.userId, async (tx) => {
    const cfg = await getSettings(tx, ['free_cancel_hours', 'self_reschedules_per_month']);
    let direct = party === 'staff';
    if (party === 'guardian' || party === 'student') {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const [{ used }] = await tx
        .select({ used: sql<number>`count(*)::int` })
        .from(rescheduleRequests)
        .where(and(eq(rescheduleRequests.requestedBy, viewer.userId), eq(rescheduleRequests.status, 'accepted'), eq(rescheduleRequests.decidedBy, viewer.userId), gte(rescheduleRequests.createdAt, monthStart)));
      direct = hoursUntil(now, s.startsAt) >= cfg.free_cancel_hours && used < cfg.self_reschedules_per_month;
    }
    if (!direct) {
      // خارج المهلة أو تجاوز الحد، أو طلب من المعلمة: يُرسل طلباً للموافقة
      const [req] = await tx
        .insert(rescheduleRequests)
        .values({ sessionId: s.id, requestedBy: viewer.userId, proposedStartsAt: input.startsAt, reason: input.reason })
        .returning();
      await audit(tx, viewer, { action: 'session.reschedule_request', entity: 'reschedule_requests', entityId: req.id, after: req, reason: input.reason }, ip);
      return { mode: 'requested' as const, requestId: req.id };
    }
    const moved = await moveSession(tx, viewer, s, input.startsAt);
    await tx.insert(rescheduleRequests).values({
      sessionId: s.id,
      requestedBy: viewer.userId,
      proposedStartsAt: input.startsAt,
      reason: input.reason,
      status: 'accepted',
      decidedBy: viewer.userId,
      decidedAt: now,
    });
    await audit(tx, viewer, { action: 'session.reschedule', entity: 'sessions', entityId: s.id, before: { startsAt: s.startsAt }, after: { startsAt: moved.startsAt }, reason: input.reason }, ip);
    return { mode: 'moved' as const, startsAt: moved.startsAt.toISOString() };
  });
}

/** قبول طلب إعادة الجدولة أو رفضه: المعلمة لطلب الأسرة، والإدارة لأي طلب */
export async function decideReschedule(viewer: Viewer, requestId: string, accept: boolean, ip?: string | null) {
  return asSystem(viewer.userId, async (tx) => {
    const [req] = await tx.select().from(rescheduleRequests).where(eq(rescheduleRequests.id, requestId)).for('update');
    if (!req) throw notFound('الطلب');
    if (req.status !== 'pending') throw conflict('already_decided', 'حُسم هذا الطلب من قبل');
    const [s] = await tx.select().from(sessions).where(eq(sessions.id, req.sessionId));
    const party = await partyOf(tx, viewer, s);
    const requesterIsTeacher = (await tx.select({ id: teachers.id }).from(teachers).where(and(eq(teachers.id, s.teacherId), eq(teachers.userId, req.requestedBy)))).length > 0;
    // طلب الأسرة تحسمه المعلمة، وطلب المعلمة تحسمه الأسرة، والإدارة تحسم أيّهما
    const family = party === 'guardian' || party === 'student';
    const allowed = party === 'staff' || (party === 'teacher' && !requesterIsTeacher) || (family && requesterIsTeacher);
    if (!allowed) throw forbidden();
    if (accept) {
      if (s.status !== 'scheduled') throw conflict('not_reschedulable', 'لا يمكن إعادة جدولة هذه الحصة بحالتها الحالية');
      await moveSession(tx, viewer, s, req.proposedStartsAt);
    }
    const [done] = await tx
      .update(rescheduleRequests)
      .set({ status: accept ? 'accepted' : 'rejected', decidedBy: viewer.userId, decidedAt: new Date() })
      .where(eq(rescheduleRequests.id, req.id))
      .returning();
    await audit(tx, viewer, { action: accept ? 'reschedule.accept' : 'reschedule.reject', entity: 'reschedule_requests', entityId: req.id, before: req, after: done }, ip);
    return done;
  });
}

/**
 * زر «ادخل الحصة»: يُسجّل الحضور ثم يعيد رابط Meet لطرفي الحصة وحدهما،
 * داخل النافذة من 10 دقائق قبل الموعد حتى 15 دقيقة بعد نهايته.
 */
export async function joinSession(viewer: Viewer, sessionId: string, now = new Date()): Promise<string> {
  const { s, party } = await loadForViewer(viewer, sessionId);
  if (party !== 'teacher' && party !== 'student' && party !== 'guardian') throw forbidden();
  if (s.status !== 'scheduled') throw conflict('not_joinable', 'هذه الحصة غير متاحة للدخول');
  const duration = Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / MIN);
  const state = joinState(now, s.startsAt, duration);
  if (state === 'upcoming') throw new ApiError(409, 'join_not_open', 'يظهر زر الدخول قبل الموعد بعشر دقائق', { opensAt: new Date(s.startsAt.getTime() - 10 * MIN) });
  if (state === 'closed') throw new ApiError(409, 'join_closed', 'انتهت نافذة الدخول لهذه الحصة');
  return asSystem(viewer.userId, async (tx) => {
    const [m] = await tx.select().from(meetings).where(eq(meetings.sessionId, s.id));
    if (!m?.joinUrl) throw new ApiError(409, 'meeting_pending', 'رابط الحصة قيد التجهيز، حاولي بعد دقيقة');
    await tx.insert(sessionAttendance).values({ sessionId: s.id, userId: viewer.userId, side: party === 'teacher' ? 'teacher' : 'student' });
    return m.joinUrl;
  });
}

/** الطلبات المعلّقة التي يملك المستخدم حسمها */
export async function pendingReschedules(viewer: Viewer) {
  return asSystem(viewer.userId, async (tx) => {
    const staff = can(viewer.roles, 'sessions.reschedule.any');
    const [mine] = await tx.select({ id: teachers.id }).from(teachers).where(eq(teachers.userId, viewer.userId));
    if (!staff && !mine) return [];
    return tx
      .select({ id: rescheduleRequests.id, sessionId: rescheduleRequests.sessionId, proposedStartsAt: rescheduleRequests.proposedStartsAt, reason: rescheduleRequests.reason, currentStartsAt: sessions.startsAt, student: students.displayName, createdAt: rescheduleRequests.createdAt })
      .from(rescheduleRequests)
      .innerJoin(sessions, eq(sessions.id, rescheduleRequests.sessionId))
      .innerJoin(students, eq(students.id, sessions.studentId))
      .where(and(eq(rescheduleRequests.status, 'pending'), staff ? undefined : and(eq(sessions.teacherId, mine.id), ne(rescheduleRequests.requestedBy, viewer.userId))))
      .orderBy(desc(rescheduleRequests.createdAt));
  });
}

