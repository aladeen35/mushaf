// تقرير الحصة والتقدم (القسم 9): المعلمة تكتب المقاطع والأخطاء، فتُحسب نسبة
// الإتقان بأوزان الإعدادات، والمقطع الجديد فوق الحد يُضاف للمحفوظ وتُجدول
// مراجعته المتباعدة. إتمام جزء كامل يرسل للأسرة تهنئة «الشرافة».
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { LOW_BALANCE } from '@/lib/domain/billing';
import { mastery, NO_MISTAKES, suggestGrade, gradeLabel, type Grade, type Mistakes } from '@/lib/domain/mastery';
import { can } from '@/lib/domain/permissions';
import { REVIEW_INTERVALS_DAYS } from '@/lib/domain/review';
import { ayahIndex, formatRange, fromIndex, juzInfo, isValidRef, type AyahRef } from '@/lib/quran';
import { juzOrdinal } from '@/lib/quran/names';
import { addDays } from '@/lib/tz';
import { asSystem, asUser, type Tx } from '../db/client';
import {
  guardians,
  guardianStudents,
  memorizationPlans,
  memorizedRanges,
  quranAyahs,
  reportInternalNotes,
  reportSegments,
  reviewSchedule,
  segmentMistakes,
  sessionReports,
  sessions,
  students,
  subscriptions,
  teacherDisciplineEvents,
  teachers,
} from '../db/schema';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { audit } from './audit';
import { notify } from './notifications';
import { getSettings } from './settings';

const MIN = 60_000;
const HOUR = 60 * MIN;

export type SegmentType = 'new' | 'near_review' | 'far_review' | 'recitation' | 'test';
export type Attendance = 'present' | 'late' | 'absent' | 'teacher_absent';

export type SegmentInput = { type: SegmentType; from: AyahRef; to: AyahRef; homework?: boolean; mistakes?: Partial<Mistakes> };
export type ReportInput = { attendance: Attendance; grade?: Grade; guardianNote?: string | null; internalNote?: string | null; segments: SegmentInput[] };

const STATUS_FOR: Record<Attendance, 'completed' | 'student_absent' | 'teacher_absent'> = {
  present: 'completed',
  late: 'completed',
  absent: 'student_absent',
  teacher_absent: 'teacher_absent',
};

const today = (now = new Date()) => now.toISOString().slice(0, 10);

/** عدد آيات الجزء المغطّاة بنطاقات المحفوظ */
async function juzCoverage(tx: Tx, studentId: string, juz: number): Promise<number> {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(distinct ${quranAyahs.id})::int` })
    .from(quranAyahs)
    .innerJoin(memorizedRanges, and(eq(memorizedRanges.studentId, studentId), sql`${quranAyahs.id} between ${memorizedRanges.fromAyah} and ${memorizedRanges.toAyah}`))
    .where(eq(quranAyahs.juz, juz));
  return n;
}

const juzzesOf = (from: number, to: number) => {
  const a = juzOfIndex(from);
  const b = juzOfIndex(to);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
};

function juzOfIndex(i: number): number {
  for (let j = 30; j >= 1; j--) if (ayahIndex(juzInfo(j).from) <= i) return j;
  return 1;
}

export async function submitReport(viewer: Viewer, sessionId: string, input: ReportInput, ip?: string | null) {
  for (const s of input.segments) {
    if (!isValidRef(s.from) || !isValidRef(s.to)) throw badRequest('ayah_invalid', 'رقم آية غير صحيح');
    if (ayahIndex(s.to) < ayahIndex(s.from)) throw new ApiError(422, 'range_invalid', 'نهاية المقطع قبل بدايته');
  }
  if (input.attendance !== 'absent' && input.attendance !== 'teacher_absent' && !input.segments.some((s) => !s.homework)) {
    throw badRequest('segments_required', 'أضيفي مقطعاً واحداً على الأقل مما سُمّع في الحصة');
  }

  return asSystem(viewer.userId, async (tx) => {
    const [s] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for('update');
    if (!s) throw notFound('الحصة');
    const [t] = await tx.select().from(teachers).where(eq(teachers.id, s.teacherId));
    const isTeacher = t?.userId === viewer.userId;
    const isAcademic = can(viewer.roles, 'reports.edit');
    if (!isTeacher && !isAcademic) throw forbidden();
    const now = new Date();
    if (now < s.startsAt) throw conflict('session_not_started', 'لا يُكتب التقرير قبل بدء الحصة');
    if (!['scheduled', 'completed', 'student_absent', 'teacher_absent'].includes(s.status)) {
      throw conflict('session_not_reportable', 'لا يُكتب تقرير لحصة ملغاة أو غير مؤكدة');
    }

    const cfg = await getSettings(tx, ['mastery_weights', 'memorized_threshold', 'report_deadline_hours']);
    const [existing] = await tx.select().from(sessionReports).where(eq(sessionReports.sessionId, s.id));
    if (existing && !isAcademic && now.getTime() > s.endsAt.getTime() + cfg.report_deadline_hours * HOUR) {
      throw new ApiError(403, 'report_locked', 'انتهت مهلة تعديل التقرير؛ التعديل عبر المشرفة');
    }

    const scored = input.segments.map((seg, position) => {
      const m = { ...NO_MISTAKES, ...seg.mistakes };
      const pct = seg.homework ? null : mastery(m, cfg.mastery_weights);
      return { seg, position, m, pct, from: ayahIndex(seg.from), to: ayahIndex(seg.to) };
    });
    const done = scored.filter((x) => x.pct !== null);
    const avg = done.length ? Math.round((done.reduce((a, x) => a + x.pct!, 0) / done.length) * 100) / 100 : null;
    const grade = input.attendance === 'present' || input.attendance === 'late' ? (input.grade ?? (avg === null ? null : suggestGrade(avg))) : null;

    let report: typeof sessionReports.$inferSelect;
    if (existing) {
      // تعديل: تُستبدل المقاطع، ويُزال ما أُضيف بها للمحفوظ والمراجعة
      const oldSegs = await tx.select().from(reportSegments).where(eq(reportSegments.reportId, existing.id));
      const counted = oldSegs.filter((x) => x.counted);
      if (counted.length) {
        await tx.delete(reviewSchedule).where(
          and(eq(reviewSchedule.studentId, s.studentId), eq(reviewSchedule.memorizedOn, existing.createdAt.toISOString().slice(0, 10)), inArray(reviewSchedule.fromAyah, counted.map((c) => c.fromAyah))),
        );
      }
      await tx.delete(reportSegments).where(eq(reportSegments.reportId, existing.id));
      [report] = await tx
        .update(sessionReports)
        .set({ attendance: input.attendance, grade, mastery: avg, guardianNote: input.guardianNote ?? null })
        .where(eq(sessionReports.id, existing.id))
        .returning();
    } else {
      [report] = await tx
        .insert(sessionReports)
        .values({ sessionId: s.id, teacherId: s.teacherId, studentId: s.studentId, attendance: input.attendance, grade, mastery: avg, guardianNote: input.guardianNote ?? null })
        .returning();
      if (report.late) await tx.insert(teacherDisciplineEvents).values({ teacherId: s.teacherId, sessionId: s.id, kind: 'report_late' });
      if (input.attendance === 'teacher_absent') await tx.insert(teacherDisciplineEvents).values({ teacherId: s.teacherId, sessionId: s.id, kind: 'absent_unexcused' });
    }

    if (input.internalNote?.trim()) {
      await tx
        .insert(reportInternalNotes)
        .values({ reportId: report.id, note: input.internalNote.trim(), authorId: viewer.userId })
        .onConflictDoUpdate({ target: reportInternalNotes.reportId, set: { note: input.internalNote.trim(), authorId: viewer.userId } });
    } else if (existing) {
      await tx.delete(reportInternalNotes).where(eq(reportInternalNotes.reportId, report.id));
    }

    const memorizedOn = today(report.createdAt);
    const juzBefore = new Map<number, number>();
    const newlyCounted = scored.filter((x) => x.seg.type === 'new' && x.pct !== null && x.pct >= cfg.memorized_threshold);
    for (const j of new Set(newlyCounted.flatMap((x) => juzzesOf(x.from, x.to)))) juzBefore.set(j, await juzCoverage(tx, s.studentId, j));

    for (const x of scored) {
      const counted = newlyCounted.includes(x);
      const [seg] = await tx
        .insert(reportSegments)
        .values({ reportId: report.id, position: x.position, type: x.seg.type, fromAyah: x.from, toAyah: x.to, homework: Boolean(x.seg.homework), mastery: x.pct, counted })
        .returning();
      const mistakes = (Object.keys(x.m) as (keyof Mistakes)[]).filter((k) => x.m[k] > 0).map((kind) => ({ segmentId: seg.id, kind, count: x.m[kind] }));
      if (mistakes.length) await tx.insert(segmentMistakes).values(mistakes);
      if (counted) {
        await tx.insert(memorizedRanges).values({ studentId: s.studentId, fromAyah: x.from, toAyah: x.to, source: 'report', segmentId: seg.id, memorizedOn });
        await tx.insert(reviewSchedule).values({ studentId: s.studentId, fromAyah: x.from, toAyah: x.to, memorizedOn, step: 0, dueOn: addDays(memorizedOn, REVIEW_INTERVALS_DAYS[0]) });
      }
      // مراجعة متقنة تُنجز خطوات المراجعة المستحقة داخل نطاقها وتجدول التالية
      if ((x.seg.type === 'near_review' || x.seg.type === 'far_review') && x.pct !== null && x.pct >= cfg.memorized_threshold) {
        const due = await tx
          .update(reviewSchedule)
          .set({ doneAt: now })
          .where(and(eq(reviewSchedule.studentId, s.studentId), isNull(reviewSchedule.doneAt), lte(reviewSchedule.dueOn, addDays(today(now), 1)), gte(reviewSchedule.fromAyah, x.from), lte(reviewSchedule.toAyah, x.to)))
          .returning();
        const next = due.filter((r) => r.step + 1 < REVIEW_INTERVALS_DAYS.length);
        if (next.length) {
          await tx.insert(reviewSchedule).values(
            next.map((r) => ({ studentId: r.studentId, fromAyah: r.fromAyah, toAyah: r.toAyah, memorizedOn: r.memorizedOn, step: r.step + 1, dueOn: addDays(r.memorizedOn, REVIEW_INTERVALS_DAYS[r.step + 1]) })),
          );
        }
      }
    }

    // حالة الحصة من الحضور؛ مشغّل القاعدة يخصم الرصيد أو يعيده في المعاملة نفسها
    const status = STATUS_FOR[input.attendance];
    if (s.status !== status) await tx.update(sessions).set({ status }).where(eq(sessions.id, s.id));

    const [st] = await tx.select().from(students).where(eq(students.id, s.studentId));
    const family = [
      ...(await tx.select({ id: guardians.userId }).from(guardianStudents).innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId)).where(eq(guardianStudents.studentId, st.id))).map((r) => r.id),
      ...(st.userId ? [st.userId] : []),
    ];
    if (!existing) {
      const main = done.find((x) => x.seg.type === 'new') ?? done[0];
      await notify(tx, {
        userIds: family,
        event: 'report_ready',
        vars: {
          student: st.displayName,
          range: main ? formatRange(fromIndex(main.from), fromIndex(main.to)) : input.attendance === 'absent' ? 'غياب' : 'لم تُعقد الحصة',
          grade: grade ? gradeLabel(grade) : '—',
        },
        data: { reportId: report.id, sessionId: s.id },
      });
    }
    for (const [juz, before] of juzBefore) {
      const total = juzInfo(juz).ayahs;
      if (before < total && (await juzCoverage(tx, s.studentId, juz)) >= total) {
        await notify(tx, { userIds: family, event: 'juz_completed', vars: { student: st.displayName, juz: juzOrdinal(juz) }, data: { studentId: st.id, juz } });
      }
    }
    // تنبيه الرصيد المنخفض عند أول خصم فقط، لا عند تعديل تقرير قائم
    if (s.subscriptionId && !s.isMakeup && s.status === 'scheduled' && (status === 'student_absent' || status === 'completed')) {
      const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, s.subscriptionId));
      if (sub && sub.sessionsRemaining <= LOW_BALANCE) {
        await notify(tx, {
          userIds: family,
          event: 'balance_low',
          vars: { student: st.displayName, remaining: sub.sessionsRemaining === 0 ? 'لا حصص' : sub.sessionsRemaining === 1 ? 'حصة واحدة' : 'حصتان' },
          data: { subscriptionId: sub.id },
        });
      }
    }
    await audit(tx, viewer, { action: existing ? 'report.edit' : 'report.create', entity: 'session_reports', entityId: report.id, before: existing ?? null, after: { attendance: report.attendance, grade, mastery: avg } }, ip);
    return { id: report.id, mastery: avg, grade, late: report.late, counted: newlyCounted.length, sessionStatus: status };
  });
}

/** تقارير الطالب كما يراها المستخدم؛ الملاحظة الداخلية تُحجب عن ولي الأمر بسياسة RLS */
export async function studentReports(viewer: Viewer, studentId: string, limit = 20) {
  return asUser(viewer.userId, async (tx) => {
    const [st] = await tx.select({ id: students.id }).from(students).where(eq(students.id, studentId));
    if (!st) throw notFound('الطالب');
    const rows = await tx
      .select({ r: sessionReports, startsAt: sessions.startsAt, teacher: teachers.displayName, internalNote: reportInternalNotes.note })
      .from(sessionReports)
      .innerJoin(sessions, eq(sessions.id, sessionReports.sessionId))
      .innerJoin(teachers, eq(teachers.id, sessionReports.teacherId))
      .leftJoin(reportInternalNotes, eq(reportInternalNotes.reportId, sessionReports.id))
      .where(eq(sessionReports.studentId, studentId))
      .orderBy(desc(sessions.startsAt))
      .limit(limit);
    const ids = rows.map((x) => x.r.id);
    const segs = ids.length ? await tx.select().from(reportSegments).where(inArray(reportSegments.reportId, ids)).orderBy(asc(reportSegments.position)) : [];
    const mist = segs.length ? await tx.select().from(segmentMistakes).where(inArray(segmentMistakes.segmentId, segs.map((x) => x.id))) : [];
    return rows.map(({ r, startsAt, teacher, internalNote }) => ({
      id: r.id,
      sessionId: r.sessionId,
      startsAt,
      teacher,
      attendance: r.attendance,
      grade: r.grade,
      mastery: r.mastery,
      guardianNote: r.guardianNote,
      late: r.late,
      ...(internalNote !== null ? { internalNote } : {}),
      segments: segs
        .filter((x) => x.reportId === r.id)
        .map((x) => ({
          type: x.type,
          from: fromIndex(x.fromAyah),
          to: fromIndex(x.toAyah),
          label: formatRange(fromIndex(x.fromAyah), fromIndex(x.toAyah)),
          homework: x.homework,
          mastery: x.mastery,
          counted: x.counted,
          mistakes: Object.fromEntries(mist.filter((m) => m.segmentId === x.id).map((m) => [m.kind, m.count])),
        })),
    }));
  });
}

/** خريطة الأجزاء والإحصاءات لصفحة التقدم */
export async function studentProgress(viewer: Viewer, studentId: string) {
  return asUser(viewer.userId, async (tx) => {
    const [st] = await tx.select().from(students).where(eq(students.id, studentId));
    if (!st) throw notFound('الطالب');
    const perJuz = await tx
      .select({ juz: quranAyahs.juz, n: sql<number>`count(distinct ${quranAyahs.id})::int` })
      .from(quranAyahs)
      .innerJoin(memorizedRanges, and(eq(memorizedRanges.studentId, studentId), sql`${quranAyahs.id} between ${memorizedRanges.fromAyah} and ${memorizedRanges.toAyah}`))
      .groupBy(quranAyahs.juz);
    const juz = Array.from({ length: 30 }, (_, i) => {
      const total = juzInfo(i + 1).ayahs;
      const got = perJuz.find((x) => x.juz === i + 1)?.n ?? 0;
      return { juz: i + 1, memorized: got, total, pct: Math.round((got / total) * 1000) / 10, complete: got >= total };
    });
    const recent = await tx
      .select({ mastery: sessionReports.mastery, grade: sessionReports.grade, attendance: sessionReports.attendance, at: sessionReports.createdAt })
      .from(sessionReports)
      .where(eq(sessionReports.studentId, studentId))
      .orderBy(desc(sessionReports.createdAt))
      .limit(12);
    const [sub] = await tx
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.studentId, studentId), eq(subscriptions.status, 'active')))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1);
    const reviews = await tx
      .select()
      .from(reviewSchedule)
      .where(and(eq(reviewSchedule.studentId, studentId), isNull(reviewSchedule.doneAt), lte(reviewSchedule.dueOn, addDays(today(), 7))))
      .orderBy(asc(reviewSchedule.dueOn))
      .limit(10);
    const [plan] = await tx.select().from(memorizationPlans).where(eq(memorizationPlans.studentId, studentId));
    const ayahs = juz.reduce((a, j) => a + j.memorized, 0);
    return {
      student: { id: st.id, displayName: st.displayName },
      memorizedAyahs: ayahs,
      completedJuz: juz.filter((j) => j.complete).map((j) => j.juz),
      juz,
      recent: recent.reverse(),
      attendance: {
        present: recent.filter((r) => r.attendance === 'present' || r.attendance === 'late').length,
        absent: recent.filter((r) => r.attendance === 'absent').length,
      },
      balance: sub ? { remaining: sub.sessionsRemaining, total: sub.sessionsTotal + sub.rolledOver, expiresAt: sub.expiresAt } : null,
      reviewsDue: reviews.map((r) => ({ label: formatRange(fromIndex(r.fromAyah), fromIndex(r.toAyah)), dueOn: r.dueOn, step: r.step })),
      plan: plan ? { direction: plan.direction, start: fromIndex(plan.startAyah), weeklyTargetAyahs: plan.weeklyTargetAyahs, newRatio: plan.newRatio } : null,
    };
  });
}

export async function setPlan(
  viewer: Viewer,
  studentId: string,
  input: { direction: 'nas_to_baqarah' | 'baqarah_to_nas'; start: AyahRef; weeklyTargetAyahs: number; newRatio: number },
  ip?: string | null,
) {
  if (!isValidRef(input.start)) throw badRequest('ayah_invalid', 'رقم آية غير صحيح');
  return asSystem(viewer.userId, async (tx) => {
    const [st] = await tx.select().from(students).where(eq(students.id, studentId));
    if (!st) throw notFound('الطالب');
    const [t] = st.teacherId ? await tx.select().from(teachers).where(eq(teachers.id, st.teacherId)) : [];
    if (!(t?.userId === viewer.userId || can(viewer.roles, 'reports.edit'))) throw forbidden();
    const values = { direction: input.direction, startAyah: ayahIndex(input.start), weeklyTargetAyahs: input.weeklyTargetAyahs, newRatio: input.newRatio, setBy: viewer.userId };
    const [before] = await tx.select().from(memorizationPlans).where(eq(memorizationPlans.studentId, studentId));
    const [plan] = await tx.insert(memorizationPlans).values({ studentId, ...values }).onConflictDoUpdate({ target: memorizationPlans.studentId, set: values }).returning();
    await audit(tx, viewer, { action: 'plan.set', entity: 'memorization_plans', entityId: plan.id, before: before ?? null, after: plan }, ip);
    return { direction: plan.direction, start: fromIndex(plan.startAyah), weeklyTargetAyahs: plan.weeklyTargetAyahs, newRatio: plan.newRatio };
  });
}

/** للعامل: حصص انتهت منذ أكثر من مهلة التقرير ولم يُكتب لها تقرير */
export async function lateReports(tx: Tx, now = new Date()) {
  const cfg = await getSettings(tx, ['report_deadline_hours']);
  return tx
    .select({ sessionId: sessions.id, teacherId: sessions.teacherId, teacherUser: teachers.userId, endsAt: sessions.endsAt })
    .from(sessions)
    .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
    .leftJoin(sessionReports, eq(sessionReports.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.status, 'scheduled'),
        isNull(sessionReports.id),
        lte(sessions.endsAt, new Date(now.getTime() - cfg.report_deadline_hours * HOUR)),
        gte(sessions.endsAt, new Date(now.getTime() - 7 * 24 * HOUR)),
      ),
    );
}
