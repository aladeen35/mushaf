// الاستعلامات التي تستعملها الشاشات، فوق أي مصدر بيانات بالشكل نفسه.
import { juzProgress, memorizedTotal, reportMastery, segmentAyahs, segmentMastery } from '../progress';
import type { Report, Session } from '../types';
import type { RawData } from './types';

const byStart = (a: Session, b: Session) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export function makeDataset(raw: RawData, clock: () => Date, mode: 'demo' | 'live') {
  const { students, teachers, sessions, reports, payments, notifications } = raw;

  const sessionsOf = (studentIds: string[]) => sessions.filter((s) => studentIds.includes(s.studentId)).sort(byStart);

  /** الحصة الجارية تبقى «قادمة» حتى تنتهي */
  const upcoming = (studentIds: string[], at = clock()) =>
    sessionsOf(studentIds).filter((s) => s.status === 'scheduled' && Date.parse(s.startsAt) + s.durationMin * 60_000 > at.getTime());

  const past = (studentIds: string[], at = clock()) =>
    sessionsOf(studentIds)
      .filter((s) => s.status !== 'scheduled' || Date.parse(s.startsAt) + s.durationMin * 60_000 <= at.getTime())
      .reverse();

  const getSession = (id: string) => sessions.find((s) => s.id === id);

  return {
    ...raw,
    mode,
    now: clock,
    getTeacher: (id: string) => teachers.find((t) => t.id === id) ?? UNKNOWN_TEACHER,
    getStudent: (id: string) => students.find((s) => s.id === id),
    childrenOf: () => students.filter((s) => s.guardianId === raw.guardian.id),
    getReport: (id: string) => reports.find((r) => r.id === id),
    getPayment: (ref: string) => payments.find((p) => p.ref === ref),
    getSession,
    sessionsOf,
    upcoming,
    past,
    reportsOf: (studentId: string) => reports.filter((r) => r.studentId === studentId).sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt)),
    reportSessionDate: (r: Report) => new Date(getSession(r.sessionId)?.startsAt ?? r.writtenAt),
    unreadCount: () => notifications.filter((n) => !n.read).length,
    attendanceRate(studentId: string) {
      const done = past([studentId]).filter((s) => s.status !== 'cancelled');
      if (!done.length) return 100;
      return Math.round((done.filter((s) => s.status === 'completed').length / done.length) * 100);
    },
    juzProgress,
    memorizedTotal,
    reportMastery,
    segmentAyahs,
    segmentMastery,
  };
}

export type Dataset = ReturnType<typeof makeDataset>;

/** معلمة غير موجودة في البيانات (حُذفت أو لم تُسند بعد) */
const UNKNOWN_TEACHER = { id: '', name: 'لم تُحدَّد المعلمة', headline: '', riwayah: 'حفص عن عاصم', rating: 0, categories: [], studentsCount: 0 } as RawData['teachers'][number];
