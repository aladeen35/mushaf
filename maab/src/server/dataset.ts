// بيانات الشاشات من القاعدة للمستخدم المسجّل، بالشكل نفسه لبيانات العرض.
// كل القراءات بهوية المستخدم (RLS)، فولي الأمر لا يرى إلا أبناءه، والملاحظة
// الداخلية للتقرير لا تصله، والمعلمة ترى طلابها فقط.
import 'server-only';
import { and, asc, avg, desc, eq, gte, inArray, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DURATIONS, type Duration, type PlanId } from '@/lib/domain/billing';
import type { CountryCode, Currency } from '@/lib/domain/market';
import { mastery as masteryOf, NO_MISTAKES, type Mistakes } from '@/lib/domain/mastery';
import { can, isStaff, ROLES } from '@/lib/domain/permissions';
import { ADULT_AGE } from '@/lib/domain/students';
import { makeDataset, type Dataset } from '@/lib/data/queries';
import type { AdminKpis, AdminQueue, GuardianProfile, PendingPayment, Prices, RawData, RosterEntry, Section, TeacherSession } from '@/lib/data/types';
import { fmtTime, setDisplayTimezone } from '@/lib/format';
import { countAyahs, formatRange, fromIndex, type AyahRef } from '@/lib/quran';
import { pageOf } from '@/lib/quran/server';
import { localParts, zonedToUtc } from '@/lib/tz';
import type { AppNotification, NotificationKind, Payment, Range, Report, Session, SessionStatus, Student, Teacher, TeacherApplication } from '@/lib/types';
import { viewerFromToken, type Viewer } from './api/route';
import { SESSION_COOKIE } from './auth/session';
import { homeFor } from './auth/users';
import { asSystem, asUser, type Tx } from './db/client';
import * as t from './db/schema';
import { ageOn } from './services/students';

const DAY = 86_400_000;
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const EMPTY_KPIS: AdminKpis = { activeStudents: 0, teachers: 0, activeSubscriptions: 0, endingThisWeek: 0, revenueMonth: {}, attendance: 0 };
const EMPTY_QUEUE: AdminQueue = { payments: 0, applications: 0, reschedules: 0, unassigned: 0, lateReports: 0 };

function emptyRaw(guardian: GuardianProfile): RawData {
  return {
    guardian,
    students: [],
    teachers: [],
    sessions: [],
    reports: [],
    payments: [],
    notifications: [],
    PRICES: { SAR: { basic: {}, regular: {}, intensive: {} }, SDG: { basic: {}, regular: {}, intensive: {} }, USD: { basic: {}, regular: {}, intensive: {} } },
    PAYMENT_ACCOUNTS: [],
    monthlyAyahs: {},
    me: null,
    teacherStats: null,
    availability: null,
    teacherToday: [],
    teacherPendingReports: [],
    teacherRoster: [],
    adminKpis: EMPTY_KPIS,
    adminQueue: EMPTY_QUEUE,
    pendingPayments: [],
    applications: [],
    audit: [],
    weeklySessions: [],
  };
}

const ALLOWED: Record<Section, (v: Viewer) => boolean> = {
  guardian: (v) => v.roles.some((r) => r === 'guardian' || r === 'adult_student' || r === 'minor_student'),
  teacher: (v) => v.roles.includes('teacher'),
  admin: (v) => isStaff(v.roles),
};

/** المستخدم الحالي أو التحويل لصفحة الدخول/وجهته */
export async function requireViewer(section: Section): Promise<Viewer> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const viewer = await viewerFromToken(token);
  if (!viewer) redirect('/login');
  if (!viewer.roles.length) redirect('/onboarding');
  if (!ALLOWED[section](viewer)) redirect(homeFor(viewer.roles));
  return viewer;
}

export async function liveDataset(section: Section): Promise<Dataset> {
  const viewer = await requireViewer(section);
  setDisplayTimezone(viewer.user.timezone);
  const raw = section === 'guardian' ? await guardianRaw(viewer) : section === 'teacher' ? await teacherRaw(viewer) : await adminRaw(viewer);
  return makeDataset(raw, () => new Date(), 'live');
}

// ——— تحويل صفوف القاعدة إلى شكل الشاشات ———

const ref = (i: number): AyahRef => fromIndex(i);
const range = (a: number, b: number): Range => ({ from: ref(a), to: ref(b) });

function profileOf(viewer: Viewer, guardianId: string, city: string | null): GuardianProfile {
  const isSelf = viewer.roles.includes('adult_student') && !viewer.roles.includes('guardian');
  return {
    id: guardianId,
    name: viewer.user.fullName || 'مستخدمة مآب',
    role: viewer.roles.includes('minor_student') ? ROLES.minor_student : isSelf ? ROLES.adult_student : 'ولي أمر',
    city: city ?? '',
    country: viewer.user.country as CountryCode,
    timezone: viewer.user.timezone,
    currency: viewer.user.currency,
    phone: viewer.user.phone ?? '',
    email: viewer.user.email ?? '',
  };
}

const SESSION_STATUS: Partial<Record<string, SessionStatus>> = {
  scheduled: 'scheduled',
  completed: 'completed',
  student_absent: 'student_absent',
  teacher_absent: 'teacher_absent',
  excused: 'excused',
  technical_issue: 'technical_issue',
  cancelled: 'cancelled',
};

const KIND: Record<string, NotificationKind> = {
  session_reminder_24h: 'reminder',
  session_reminder_1h: 'reminder',
  report_ready: 'report',
  juz_completed: 'sharafa',
  report_late: 'report',
  payment_approved: 'payment',
  payment_rejected: 'payment',
  payment_submitted: 'payment',
  balance_low: 'balance',
  session_changed: 'reschedule',
  application_update: 'teacher',
};

type StudentRow = typeof t.students.$inferSelect;

/** الطلاب بكل ما تعرضه الشاشات: الاشتراك ومواعيده، والخطة، والمحفوظ، والموضع الحالي */
async function hydrateStudents(tx: Tx, rows: StudentRow[], guardianIdOf: (s: StudentRow) => string, tz: string): Promise<Student[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [subs, plans, ranges, homework] = await Promise.all([
    tx
      .select({ sub: t.subscriptions, code: t.plans.code })
      .from(t.subscriptions)
      .innerJoin(t.plans, eq(t.plans.id, t.subscriptions.planId))
      .where(and(inArray(t.subscriptions.studentId, ids), eq(t.subscriptions.status, 'active')))
      .orderBy(desc(t.subscriptions.expiresAt)),
    tx.select().from(t.memorizationPlans).where(inArray(t.memorizationPlans.studentId, ids)),
    tx.select().from(t.memorizedRanges).where(inArray(t.memorizedRanges.studentId, ids)).orderBy(asc(t.memorizedRanges.fromAyah)),
    tx
      .select({ studentId: t.sessionReports.studentId, from: t.reportSegments.fromAyah, to: t.reportSegments.toAyah, at: t.sessionReports.createdAt })
      .from(t.reportSegments)
      .innerJoin(t.sessionReports, eq(t.sessionReports.id, t.reportSegments.reportId))
      .where(and(inArray(t.sessionReports.studentId, ids), eq(t.reportSegments.homework, true), eq(t.reportSegments.type, 'new')))
      .orderBy(desc(t.sessionReports.createdAt)),
  ]);
  const itemIds = subs.map((s) => s.sub.orderItemId);
  const slots = itemIds.length
    ? await tx.select().from(t.recurringSlots).where(and(inArray(t.recurringSlots.orderItemId, itemIds), eq(t.recurringSlots.active, true))).orderBy(asc(t.recurringSlots.weekday))
    : [];

  return rows.map((s) => {
    const sub = subs.find((x) => x.sub.studentId === s.id);
    const mySlots = sub ? slots.filter((x) => x.orderItemId === sub.sub.orderItemId) : [];
    const plan = plans.find((p) => p.studentId === s.id);
    const hw = homework.find((h) => h.studentId === s.id);
    const memorized = ranges.filter((r) => r.studentId === s.id).map((r) => range(r.fromAyah, r.toAyah));
    // الموعد الأسبوعي بتوقيت ولي الأمر نفسه كما اختاره عند الحجز
    const slotTime = mySlots[0] ? fmtTime(zonedToUtc(localParts(new Date(), mySlots[0].timezone).date, mySlots[0].startTime.slice(0, 5), mySlots[0].timezone), tz) : '';
    const start = plan?.startAyah ?? 6231;
    return {
      id: s.id,
      name: s.displayName,
      fullName: s.fullName,
      gender: s.gender,
      birthDate: s.birthDate,
      guardianId: guardianIdOf(s),
      teacherId: s.teacherId ?? '',
      level: s.level ?? '',
      goal: s.goal ?? '',
      subscription: sub
        ? {
            plan: sub.code as PlanId,
            duration: sub.sub.durationMin as Duration,
            total: sub.sub.sessionsTotal + sub.sub.rolledOver,
            remaining: sub.sub.sessionsRemaining,
            startedAt: sub.sub.startsAt.toISOString(),
            expiresAt: sub.sub.expiresAt.toISOString(),
            days: mySlots.map((x) => WEEKDAYS[x.weekday]),
            time: slotTime,
          }
        : null,
      plan: { direction: plan?.direction ?? 'nas_to_baqarah', weeklyTarget: plan?.weeklyTargetAyahs ?? 20, newRatio: plan?.newRatio ?? 60 },
      memorized,
      current: hw ? range(hw.from, hw.to) : range(start, Math.min(start + 5, 6236)),
    };
  });
}

async function loadTeachers(tx: Tx, extraIds: string[] = []): Promise<Teacher[]> {
  const rows = await tx
    .select({
      id: t.teachers.id,
      name: t.teachers.displayName,
      headline: t.teachers.headline,
      riwayah: t.teachers.riwayah,
      categories: t.teachers.categories,
      status: t.teachers.status,
      rating: avg(t.teacherRatings.score).mapWith(Number),
      studentsCount: sql<number>`(select count(*) from students s where s.teacher_id = ${t.teachers.id} and s.deleted_at is null)::int`,
    })
    .from(t.teachers)
    .leftJoin(t.teacherRatings, eq(t.teacherRatings.teacherId, t.teachers.id))
    .where(isNull(t.teachers.deletedAt))
    .groupBy(t.teachers.id)
    .orderBy(sql`avg(${t.teacherRatings.score}) desc nulls last`, asc(t.teachers.displayName));
  return rows
    .filter((r) => r.status === 'active' || extraIds.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: `أ. ${r.name.replace(/^أ\.\s*/, '')}`,
      headline: r.headline ?? 'معلمة قرآن مجازة برواية حفص عن عاصم',
      riwayah: r.riwayah,
      rating: r.rating ? Math.round(r.rating * 10) / 10 : 0,
      categories: r.categories,
      studentsCount: r.studentsCount,
    }));
}

async function loadSessions(tx: Tx, studentIds: string[], teacherId?: string): Promise<Session[]> {
  const now = Date.now();
  const rows = await tx
    .select({ s: t.sessions, reportId: t.sessionReports.id })
    .from(t.sessions)
    .leftJoin(t.sessionReports, eq(t.sessionReports.sessionId, t.sessions.id))
    .where(
      and(
        teacherId ? eq(t.sessions.teacherId, teacherId) : inArray(t.sessions.studentId, studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']),
        ne(t.sessions.status, 'held'),
        gte(t.sessions.startsAt, new Date(now - 120 * DAY)),
        lt(t.sessions.startsAt, new Date(now + 90 * DAY)),
      ),
    )
    .orderBy(asc(t.sessions.startsAt));
  const ids = rows.map((r) => r.s.id);
  const pending = ids.length
    ? await tx
        .select({ r: t.rescheduleRequests, teacherUser: t.teachers.userId })
        .from(t.rescheduleRequests)
        .innerJoin(t.sessions, eq(t.sessions.id, t.rescheduleRequests.sessionId))
        .innerJoin(t.teachers, eq(t.teachers.id, t.sessions.teacherId))
        .where(and(inArray(t.rescheduleRequests.sessionId, ids), eq(t.rescheduleRequests.status, 'pending')))
    : [];
  return rows.map(({ s, reportId }) => {
    const req = pending.find((p) => p.r.sessionId === s.id);
    return {
      id: s.id,
      studentId: s.studentId,
      teacherId: s.teacherId,
      startsAt: s.startsAt.toISOString(),
      durationMin: Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000),
      status: SESSION_STATUS[s.status] ?? 'cancelled',
      ...(reportId ? { reportId } : {}),
      ...(req
        ? { reschedule: { proposedAt: req.r.proposedStartsAt.toISOString(), by: req.r.requestedBy === req.teacherUser ? ('teacher' as const) : ('guardian' as const), reason: req.r.reason, requestId: req.r.id } }
        : {}),
    };
  });
}

async function loadReports(tx: Tx, studentIds: string[]): Promise<Report[]> {
  if (!studentIds.length) return [];
  const rows = await tx
    .select({ r: t.sessionReports, note: t.reportInternalNotes.note })
    .from(t.sessionReports)
    .leftJoin(t.reportInternalNotes, eq(t.reportInternalNotes.reportId, t.sessionReports.id))
    .where(inArray(t.sessionReports.studentId, studentIds))
    .orderBy(desc(t.sessionReports.createdAt))
    .limit(200);
  const ids = rows.map((x) => x.r.id);
  const segs = ids.length ? await tx.select().from(t.reportSegments).where(inArray(t.reportSegments.reportId, ids)).orderBy(asc(t.reportSegments.position)) : [];
  const mist = segs.length ? await tx.select().from(t.segmentMistakes).where(inArray(t.segmentMistakes.segmentId, segs.map((s) => s.id))) : [];
  return rows.map(({ r, note }) => {
    const mine = segs.filter((s) => s.reportId === r.id);
    const mistakesOf = (segmentId: string): Mistakes => {
      const m: Mistakes = { ...NO_MISTAKES };
      for (const x of mist.filter((y) => y.segmentId === segmentId)) m[x.kind] += x.count;
      return m;
    };
    return {
      id: r.id,
      sessionId: r.sessionId,
      studentId: r.studentId,
      teacherId: r.teacherId,
      attendance: r.attendance,
      segments: mine.filter((s) => !s.homework).map((s) => ({ type: s.type, ...range(s.fromAyah, s.toAyah), mistakes: mistakesOf(s.id) })),
      grade: r.grade,
      guardianNote: r.guardianNote ?? '',
      ...(note ? { internalNote: note } : {}),
      homework: mine.filter((s) => s.homework).map((s) => ({ type: s.type, ...range(s.fromAyah, s.toAyah) })),
      writtenAt: r.createdAt.toISOString(),
    };
  });
}

async function loadNotifications(tx: Tx, userId: string, base: '/guardian' | '/teacher' | '/admin'): Promise<AppNotification[]> {
  const rows = await tx
    .select()
    .from(t.notifications)
    .where(and(eq(t.notifications.userId, userId), eq(t.notifications.channel, 'in_app')))
    .orderBy(desc(t.notifications.createdAt))
    .limit(50);
  return rows.map((n) => {
    const d = (n.data ?? {}) as Record<string, string | undefined>;
    const href = d.ref
      ? `${base}/payments/${d.ref}`
      : d.reportId && base === '/guardian'
        ? `/guardian/reports/${d.reportId}`
        : d.sessionId && base === '/teacher'
          ? `/teacher/sessions/${d.sessionId}/report`
          : d.sessionId
            ? `${base}/schedule`
            : d.studentId && n.event === 'juz_completed'
              ? `/guardian/progress/map?child=${d.studentId}`
              : undefined;
    const meta = n.event === 'juz_completed' ? { meta: { studentId: d.studentId, juz: Number(d.juz) } } : {};
    return { id: n.id, kind: KIND[n.event] ?? 'reminder', title: n.title, body: n.body, at: n.createdAt.toISOString(), read: Boolean(n.readAt), ...(href ? { href } : {}), ...meta };
  });
}

async function loadPrices(tx: Tx): Promise<Prices> {
  const rows = await tx
    .select({ code: t.plans.code, duration: t.planPrices.durationMin, currency: t.planPrices.currency, amount: t.planPrices.amount })
    .from(t.planPrices)
    .innerJoin(t.plans, eq(t.plans.id, t.planPrices.planId))
    .where(and(eq(t.planPrices.active, true), eq(t.plans.active, true)));
  const out: Prices = { SAR: { basic: {}, regular: {}, intensive: {} }, SDG: { basic: {}, regular: {}, intensive: {} }, USD: { basic: {}, regular: {}, intensive: {} } };
  for (const r of rows) if (DURATIONS.includes(r.duration as Duration)) out[r.currency][r.code as PlanId][r.duration as Duration] = r.amount;
  return out;
}

const monthName = new Intl.DateTimeFormat('ar', { month: 'long' });

async function loadMonthly(tx: Tx, studentIds: string[]): Promise<RawData['monthlyAyahs']> {
  if (!studentIds.length) return {};
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - 5, 1);
  const rows = await tx
    .select()
    .from(t.memorizedRanges)
    .where(and(inArray(t.memorizedRanges.studentId, studentIds), eq(t.memorizedRanges.source, 'report'), gte(t.memorizedRanges.memorizedOn, from.toISOString().slice(0, 10))));
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), month: monthName.format(d) };
  });
  return Object.fromEntries(
    studentIds.map((id) => [
      id,
      months.map((m) => ({
        month: m.month,
        value: rows.filter((r) => r.studentId === id && r.memorizedOn.startsWith(m.key)).reduce((n, r) => n + countAyahs(ref(r.fromAyah), ref(r.toAyah)), 0),
      })),
    ]),
  );
}

function category(st: Pick<StudentRow, 'gender' | 'birthDate'>, city: string | null): string {
  const age = ageOn(st.birthDate);
  if (age >= ADULT_AGE) return `طالبة بالغة${city ? ` · ${city}` : ''}`;
  const years = age >= 3 && age <= 10 ? `${age} سنوات` : `${age} سنة`;
  return `${st.gender === 'male' ? 'طفل' : 'طفلة'} · ${years}`;
}

// ——— ولي الأمر والطالبة ———

async function guardianRaw(viewer: Viewer): Promise<RawData> {
  return asUser(viewer.userId, async (tx) => {
    const [g] = await tx.select().from(t.guardians).where(and(eq(t.guardians.userId, viewer.userId), isNull(t.guardians.deletedAt)));
    const [me] = await tx.select({ city: t.users.city }).from(t.users).where(eq(t.users.id, viewer.userId));
    const guardianId = g?.id ?? `self:${viewer.userId}`;
    const raw = emptyRaw(profileOf(viewer, guardianId, me?.city ?? null));
    // ولي الأمر: أبناؤه المرتبطون به. القاصر: ملفه وحده
    const rows = g
      ? (
          await tx
            .select({ s: t.students })
            .from(t.guardianStudents)
            .innerJoin(t.students, eq(t.students.id, t.guardianStudents.studentId))
            .where(and(eq(t.guardianStudents.guardianId, g.id), isNull(t.students.deletedAt)))
            .orderBy(asc(t.students.createdAt))
        ).map((r) => r.s)
      : await tx.select().from(t.students).where(and(eq(t.students.userId, viewer.userId), isNull(t.students.deletedAt)));
    const ids = rows.map((r) => r.id);
    raw.students = await hydrateStudents(tx, rows, () => guardianId, viewer.user.timezone);
    raw.teachers = await loadTeachers(tx, rows.map((r) => r.teacherId).filter((x): x is string => Boolean(x)));
    raw.sessions = await loadSessions(tx, ids);
    raw.reports = await loadReports(tx, ids);
    raw.notifications = await loadNotifications(tx, viewer.userId, '/guardian');
    raw.PRICES = await loadPrices(tx);
    raw.PAYMENT_ACCOUNTS = (await tx.select().from(t.paymentAccounts).where(eq(t.paymentAccounts.active, true)).orderBy(asc(t.paymentAccounts.sort))).map((a) => ({
      method: a.method,
      currency: a.currency,
      title: a.titleAr,
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      instructions: a.instructionsAr ?? '',
    }));
    raw.monthlyAyahs = await loadMonthly(tx, ids);
    if (g) raw.payments = await loadPayments(tx, g.id);
    return raw;
  });
}

async function loadPayments(tx: Tx, guardianId: string): Promise<Payment[]> {
  const orders = await tx.select().from(t.orders).where(eq(t.orders.guardianId, guardianId)).orderBy(desc(t.orders.createdAt)).limit(50);
  if (!orders.length) return [];
  const oids = orders.map((o) => o.id);
  const [items, pays] = await Promise.all([
    tx
      .select({ orderId: t.orderItems.orderId, studentId: t.orderItems.studentId, code: t.plans.code, duration: t.orderItems.durationMin })
      .from(t.orderItems)
      .innerJoin(t.plans, eq(t.plans.id, t.orderItems.planId))
      .where(inArray(t.orderItems.orderId, oids)),
    tx.select().from(t.payments).where(inArray(t.payments.orderId, oids)).orderBy(desc(t.payments.createdAt)),
  ]);
  const receipts = pays.length
    ? await tx
        .select({ r: t.paymentReceipts, mime: t.files.mime })
        .from(t.paymentReceipts)
        .innerJoin(t.files, eq(t.files.id, t.paymentReceipts.fileId))
        .where(inArray(t.paymentReceipts.paymentId, pays.map((p) => p.id)))
        .orderBy(desc(t.paymentReceipts.createdAt))
    : [];
  return orders.flatMap((o) => {
    const item = items.find((i) => i.orderId === o.id);
    const pay = pays.find((p) => p.orderId === o.id);
    if (!item || !pay) return [];
    const rc = receipts.find((r) => r.r.paymentId === pay.id);
    return [
      {
        ref: o.ref,
        studentId: item.studentId,
        plan: item.code as PlanId,
        duration: item.duration as Duration,
        amount: o.total,
        currency: o.currency,
        method: pay.method,
        status: pay.status,
        createdAt: o.createdAt.toISOString(),
        holdExpiresAt: o.holdExpiresAt.toISOString(),
        ...(rc
          ? { receipt: { fileName: `إيصال.${rc.mime === 'application/pdf' ? 'pdf' : rc.mime === 'image/png' ? 'png' : 'jpg'}`, senderName: rc.r.senderName, transferDate: rc.r.transferDate, uploadedAt: rc.r.createdAt.toISOString() } }
          : {}),
        ...(pay.reason ? { reason: pay.reason } : {}),
      },
    ];
  });
}

// ——— المعلمة ———

async function teacherRaw(viewer: Viewer): Promise<RawData> {
  return asUser(viewer.userId, async (tx) => {
    const [me] = await tx.select().from(t.teachers).where(eq(t.teachers.userId, viewer.userId));
    const raw = emptyRaw(profileOf(viewer, `teacher:${viewer.userId}`, null));
    if (!me) return raw;
    const tz = viewer.user.timezone;
    const now = new Date();
    const rows = await tx.select().from(t.students).where(and(eq(t.students.teacherId, me.id), isNull(t.students.deletedAt))).orderBy(asc(t.students.fullName));
    const sessions = await loadSessions(tx, [], me.id);
    // طلاب حصص اليوم قد لا يكونون مسندين بعد (حصة تعويض مع معلمة أخرى)
    const extra = [...new Set(sessions.map((s) => s.studentId))].filter((id) => !rows.some((r) => r.id === id));
    const others = extra.length ? await tx.select().from(t.students).where(inArray(t.students.id, extra)) : [];
    const all = [...rows, ...others];
    const families = all.length
      ? await tx
          .select({ studentId: t.guardianStudents.studentId, guardianId: t.guardianStudents.guardianId, city: t.users.city })
          .from(t.guardianStudents)
          .innerJoin(t.guardians, eq(t.guardians.id, t.guardianStudents.guardianId))
          .innerJoin(t.users, eq(t.users.id, t.guardians.userId))
          .where(inArray(t.guardianStudents.studentId, all.map((s) => s.id)))
      : [];
    const cityOf = (id: string) => families.find((f) => f.studentId === id)?.city ?? null;
    raw.students = await hydrateStudents(tx, all, (s) => families.find((f) => f.studentId === s.id)?.guardianId ?? '', tz);
    raw.reports = await loadReports(tx, all.map((s) => s.id));
    raw.sessions = sessions;
    const [teacher] = await loadTeachers(tx, [me.id]).then((list) => list.filter((x) => x.id === me.id));
    raw.me = teacher ?? null;
    raw.teachers = teacher ? [teacher] : [];
    raw.notifications = await loadNotifications(tx, viewer.userId, '/teacher');

    const focusOf = (studentId: string) => {
      const st = raw.students.find((s) => s.id === studentId);
      const last = raw.reports.find((r) => r.studentId === studentId);
      const hw = last?.homework.find((h) => h.type === 'new') ?? last?.homework[0];
      if (hw) return { focus: `حفظ جديد: ${formatRange(hw.from, hw.to)}`, current: { from: hw.from, to: hw.to } };
      return st ? { focus: `الموضع: ${formatRange(st.current.from, st.current.to)}`, current: st.current } : { focus: 'حصة تعريفية' };
    };
    const today = localParts(now, tz).date;
    const dayStart = zonedToUtc(today, '00:00', tz).getTime();
    raw.teacherToday = sessions
      .filter((s) => Date.parse(s.startsAt) >= dayStart && Date.parse(s.startsAt) < dayStart + DAY && s.status !== 'cancelled')
      .map((s): TeacherSession => {
        const st = all.find((x) => x.id === s.studentId)!;
        return { id: s.id, studentId: s.studentId, student: st.fullName, category: category(st, cityOf(st.id)), startsAt: s.startsAt, durationMin: s.durationMin, ...focusOf(s.studentId) };
      });
    raw.teacherPendingReports = sessions
      .filter((s) => s.status === 'scheduled' && !s.reportId && Date.parse(s.startsAt) + s.durationMin * 60_000 < now.getTime() && Date.parse(s.startsAt) > now.getTime() - 7 * DAY)
      .map((s) => ({ sessionId: s.id, studentId: s.studentId, student: all.find((x) => x.id === s.studentId)?.fullName ?? '', startsAt: s.startsAt, durationMin: s.durationMin }));
    raw.teacherRoster = rows.map((st): RosterEntry => {
      const f = focusOf(st.id);
      const last = raw.reports.find((r) => r.studentId === st.id && r.segments.length);
      const next = sessions.find((s) => s.studentId === st.id && s.status === 'scheduled' && Date.parse(s.startsAt) > now.getTime());
      const avgMastery = last ? Math.round(last.segments.reduce((n, s) => n + masteryOf(s.mistakes), 0) / last.segments.length) : 0;
      return {
        id: st.id,
        name: st.fullName,
        category: category(st, cityOf(st.id)),
        current: f.current ? formatRange(f.current.from, f.current.to) : '—',
        page: f.current ? pageOf(f.current.from) : 1,
        mastery: avgMastery,
        nextAt: next?.startsAt ?? null,
      };
    });
    const windows = await tx.select().from(t.teacherAvailability).where(eq(t.teacherAvailability.teacherId, me.id)).orderBy(asc(t.teacherAvailability.weekday), asc(t.teacherAvailability.startTime));
    raw.availability = { timezone: me.timezone, windows: windows.map((w) => ({ weekday: w.weekday, start: w.startTime.slice(0, 5), end: w.endTime.slice(0, 5) })) };
    const month = sessions.filter((s) => Date.parse(s.startsAt) > now.getTime() - 30 * DAY && Date.parse(s.startsAt) < now.getTime());
    const held = month.filter((s) => s.status === 'completed');
    const counted = month.filter((s) => s.status === 'completed' || s.status === 'student_absent');
    raw.teacherStats = {
      students: rows.length,
      hours30d: Math.round((held.reduce((n, s) => n + s.durationMin, 0) / 60) * 10) / 10,
      attendance: counted.length ? Math.round((held.length / counted.length) * 100) : 100,
      rating: teacher?.rating || null,
      unread: raw.notifications.filter((n) => !n.read).length,
    };
    return raw;
  });
}

// ——— الإدارة ———

async function adminRaw(viewer: Viewer): Promise<RawData> {
  const raw = emptyRaw(profileOf(viewer, `staff:${viewer.userId}`, null));
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const n = sql<number>`count(*)::int`;
  return asSystem(viewer.userId, async (tx) => {
    const [[students], [teachers], [subs], [ending], [att], [pays], [apps], [res], [unassigned], [late]] = await Promise.all([
      tx.select({ n: sql<number>`count(distinct ${t.subscriptions.studentId})::int` }).from(t.subscriptions).where(eq(t.subscriptions.status, 'active')),
      tx.select({ n }).from(t.teachers).where(and(eq(t.teachers.status, 'active'), isNull(t.teachers.deletedAt))),
      tx.select({ n }).from(t.subscriptions).where(eq(t.subscriptions.status, 'active')),
      tx.select({ n }).from(t.subscriptions).where(and(eq(t.subscriptions.status, 'active'), lte(t.subscriptions.expiresAt, new Date(now.getTime() + 7 * DAY)))),
      tx
        .select({ done: sql<number>`count(*) filter (where ${t.sessions.status} = 'completed')::int`, all: sql<number>`count(*) filter (where ${t.sessions.status} in ('completed','student_absent'))::int` })
        .from(t.sessions)
        .where(and(gte(t.sessions.startsAt, new Date(now.getTime() - 30 * DAY)), lt(t.sessions.startsAt, now))),
      tx.select({ n }).from(t.payments).where(eq(t.payments.status, 'under_review')),
      tx.select({ n }).from(t.teacherApplications).where(and(inArray(t.teacherApplications.status, ['new', 'under_review', 'needs_info', 'interview']), isNull(t.teacherApplications.deletedAt))),
      tx.select({ n }).from(t.rescheduleRequests).where(eq(t.rescheduleRequests.status, 'pending')),
      tx
        .select({ n: sql<number>`count(distinct ${t.students.id})::int` })
        .from(t.students)
        .innerJoin(t.subscriptions, and(eq(t.subscriptions.studentId, t.students.id), eq(t.subscriptions.status, 'active')))
        .where(and(isNull(t.students.teacherId), isNull(t.students.deletedAt))),
      tx
        .select({ n })
        .from(t.sessions)
        .leftJoin(t.sessionReports, eq(t.sessionReports.sessionId, t.sessions.id))
        .where(and(eq(t.sessions.status, 'scheduled'), isNull(t.sessionReports.id), lte(t.sessions.endsAt, new Date(now.getTime() - 12 * 3_600_000)))),
    ]);
    let revenueMonth: Partial<Record<Currency, number>> = {};
    if (can(viewer.roles, 'revenue.read')) {
      const rev = await tx
        .select({ currency: t.payments.currency, total: sql<number>`coalesce(sum(${t.payments.amount}), 0)::float` })
        .from(t.payments)
        .where(and(eq(t.payments.status, 'approved'), gte(t.payments.reviewedAt, monthStart)))
        .groupBy(t.payments.currency);
      revenueMonth = Object.fromEntries(rev.map((r) => [r.currency, r.total]));
    }
    raw.adminKpis = {
      activeStudents: students.n,
      teachers: teachers.n,
      activeSubscriptions: subs.n,
      endingThisWeek: ending.n,
      revenueMonth,
      attendance: att.all ? Math.round((att.done / att.all) * 100) : 100,
    };
    raw.adminQueue = { payments: pays.n, applications: apps.n, reschedules: res.n, unassigned: unassigned.n, lateReports: late.n };

    if (can(viewer.roles, 'payments.approve')) raw.pendingPayments = await pendingPayments(tx);
    if (can(viewer.roles, 'teachers.approve')) raw.applications = await applications(tx);
    raw.notifications = await loadNotifications(tx, viewer.userId, '/admin');
    if (can(viewer.roles, 'audit.read')) raw.audit = await auditTrail(tx);
    raw.weeklySessions = await weeklySessions(tx, now);
    return raw;
  });
}

const ACTIONS: Record<string, string> = {
  'payment.approve': 'اعتمدت التحويل وفعّلت الباقة',
  'payment.rejected': 'رفضت التحويل',
  'payment.needs_fix': 'طلبت تصحيح الإيصال',
  'payment.refund': 'سجّلت استرداداً',
  'payment.receipt': 'رُفع إيصال تحويل',
  'order.create': 'أُنشئ طلب باقة',
  'order.create_on_behalf': 'أنشأت طلباً نيابةً عن ولي الأمر',
  'order.expire': 'انتهت مهلة طلب غير مدفوع',
  'session.cancel': 'أُلغيت حصة',
  'session.reschedule': 'نُقلت حصة لموعد جديد',
  'session.reschedule_request': 'طُلبت إعادة جدولة',
  'reschedule.accept': 'قُبل طلب إعادة جدولة',
  'reschedule.reject': 'رُفض طلب إعادة جدولة',
  'report.create': 'كتبت تقرير حصة',
  'report.edit': 'عدّلت تقرير حصة',
  'student.create': 'أُضيف طالب',
  'student.update': 'عُدّل ملف طالب',
  'support.impersonate': 'دخلت بحساب مستخدم بإذن مسجّل',
  'support.impersonate_end': 'أنهت الدخول بحساب مستخدم',
  'application.accepted': 'قبلت معلمة جديدة',
  'application.rejected': 'اعتذرت عن طلب معلمة',
  'availability.set': 'حدّثت أوقات الإتاحة',
  'account.onboard': 'أكمل مستخدم جديد حسابه',
  export: 'صدّرت تقريراً',
};

async function auditTrail(tx: Tx) {
  const rows = await tx
    .select({ log: t.auditLogs, actor: t.users.fullName })
    .from(t.auditLogs)
    .leftJoin(t.users, eq(t.users.id, t.auditLogs.actorId))
    .orderBy(desc(t.auditLogs.id))
    .limit(8);
  return rows.map(({ log, actor }) => ({
    who: `${log.actorRole && log.actorRole in ROLES ? ROLES[log.actorRole as keyof typeof ROLES] : 'النظام'}${actor ? ` · ${actor}` : ''}`,
    what: `${ACTIONS[log.action] ?? log.action}${log.reason ? ` — ${log.reason}` : ''}`,
    at: log.createdAt.toISOString(),
  }));
}

async function weeklySessions(tx: Tx, now: Date) {
  const start = new Date(now.getTime() - 6 * 7 * DAY);
  const rows = await tx
    .select({ at: t.sessions.startsAt })
    .from(t.sessions)
    .where(and(eq(t.sessions.status, 'completed'), gte(t.sessions.startsAt, start), lt(t.sessions.startsAt, now)));
  const fmt = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short' });
  return Array.from({ length: 6 }, (_, i) => {
    const a = start.getTime() + i * 7 * DAY;
    return {
      label: i === 5 ? 'هذا الأسبوع' : fmt.format(new Date(a)),
      value: rows.filter((r) => r.at.getTime() >= a && r.at.getTime() < a + 7 * DAY).length,
    };
  });
}

async function pendingPayments(tx: Tx): Promise<PendingPayment[]> {
  const rows = await tx
    .select({ p: t.payments, ref: t.orders.ref, payer: t.users.fullName, country: t.users.country })
    .from(t.payments)
    .innerJoin(t.orders, eq(t.orders.id, t.payments.orderId))
    .innerJoin(t.guardians, eq(t.guardians.id, t.orders.guardianId))
    .innerJoin(t.users, eq(t.users.id, t.guardians.userId))
    .where(eq(t.payments.status, 'under_review'))
    .orderBy(asc(t.payments.updatedAt));
  if (!rows.length) return [];
  const orderIds = rows.map((r) => r.p.orderId);
  const [items, receipts] = await Promise.all([
    tx
      .select({ orderId: t.orderItems.orderId, student: t.students.fullName, code: t.plans.code, duration: t.orderItems.durationMin })
      .from(t.orderItems)
      .innerJoin(t.students, eq(t.students.id, t.orderItems.studentId))
      .innerJoin(t.plans, eq(t.plans.id, t.orderItems.planId))
      .where(inArray(t.orderItems.orderId, orderIds)),
    tx
      .select({ r: t.paymentReceipts, mime: t.files.mime })
      .from(t.paymentReceipts)
      .innerJoin(t.files, eq(t.files.id, t.paymentReceipts.fileId))
      .where(inArray(t.paymentReceipts.paymentId, rows.map((r) => r.p.id)))
      .orderBy(desc(t.paymentReceipts.createdAt)),
  ]);
  return rows.map(({ p, ref: orderRef, payer, country }) => {
    const its = items.filter((i) => i.orderId === p.orderId);
    const rc = receipts.find((r) => r.r.paymentId === p.id);
    return {
      id: p.id,
      ref: orderRef,
      payer,
      country,
      student: its.map((i) => i.student).join('، '),
      plan: (its[0]?.code ?? 'basic') as PlanId,
      duration: (its[0]?.duration ?? 30) as Duration,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      uploadedAt: (rc?.r.createdAt ?? p.updatedAt).toISOString(),
      file: rc ? `إيصال.${rc.mime === 'application/pdf' ? 'pdf' : rc.mime === 'image/png' ? 'png' : 'jpg'}` : '—',
      ...(rc ? { fileId: rc.r.fileId } : {}),
      senderName: rc?.r.senderName ?? '',
    };
  });
}

async function applications(tx: Tx): Promise<TeacherApplication[]> {
  const rows = await tx.select().from(t.teacherApplications).where(isNull(t.teacherApplications.deletedAt)).orderBy(desc(t.teacherApplications.createdAt)).limit(100);
  return rows.map((a) => ({
    id: a.id,
    name: a.fullName,
    city: a.city ?? '',
    riwayah: 'حفص عن عاصم',
    experienceYears: Number(a.experience.match(/\d+/)?.[0] ?? 0),
    submittedAt: a.createdAt.toISOString(),
    status: a.status,
    ...(a.missingInfo ? { missing: a.missingInfo } : {}),
    ...(a.interviewAt ? { interviewAt: a.interviewAt.toISOString() } : {}),
  }));
}
