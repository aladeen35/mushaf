// طبقة القراءة للواجهة. اليوم تقرأ من بيانات العرض، ولاحقاً تُستبدل
// باستعلامات /api/v1 دون تغيير الشاشات (القسم 14).
import { mastery } from '../domain/mastery';
import { ayahIndex, countAyahs, JUZ, juzInfo, type JuzInfo } from '../quran';
import type { Range, Report, Segment, Session, Student } from '../types';
import { DEMO_NOW, guardian, notifications, payments, reports, sessions, students, teachers } from './data';

export const now = () => DEMO_NOW;

export const getTeacher = (id: string) => teachers.find((t) => t.id === id)!;
export const getStudent = (id: string) => students.find((s) => s.id === id);
export const childrenOf = (guardianId = guardian.id) => students.filter((s) => s.guardianId === guardianId);
export const getReport = (id: string) => reports.find((r) => r.id === id);
export const getPayment = (ref: string) => payments.find((p) => p.ref === ref);
export const getSession = (id: string) => sessions.find((s) => s.id === id);

const byStart = (a: Session, b: Session) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

export function sessionsOf(studentIds: string[]) {
  return sessions.filter((s) => studentIds.includes(s.studentId)).sort(byStart);
}

export function upcoming(studentIds: string[], at = DEMO_NOW) {
  // الحصة الجارية تبقى «قادمة» حتى تنتهي
  return sessionsOf(studentIds).filter(
    (s) => s.status === 'scheduled' && Date.parse(s.startsAt) + s.durationMin * 60_000 > at.getTime(),
  );
}

export function past(studentIds: string[], at = DEMO_NOW) {
  return sessionsOf(studentIds)
    .filter((s) => s.status !== 'scheduled' || Date.parse(s.startsAt) + s.durationMin * 60_000 <= at.getTime())
    .reverse();
}

export function reportsOf(studentId: string) {
  return reports.filter((r) => r.studentId === studentId).sort((a, b) => Date.parse(b.writtenAt) - Date.parse(a.writtenAt));
}

export const segmentAyahs = (s: Range) => countAyahs(s.from, s.to);
export const segmentMastery = (s: Segment) => mastery(s.mistakes);

/** متوسط الإتقان في التقرير موزوناً بعدد آيات كل مقطع */
export function reportMastery(r: Report): number {
  const total = r.segments.reduce((n, s) => n + segmentAyahs(s), 0);
  const sum = r.segments.reduce((n, s) => n + segmentMastery(s) * segmentAyahs(s), 0);
  return Math.round((sum / total) * 10) / 10;
}

export function reportSessionDate(r: Report) {
  return new Date(getSession(r.sessionId)!.startsAt);
}

export const unreadCount = () => notifications.filter((n) => !n.read).length;

// ——— خريطة الحفظ ———

export type JuzStatus = 'memorized' | 'in_progress' | 'not_started';

export type JuzProgress = JuzInfo & { memorizedAyahs: number; percent: number; status: JuzStatus };

/** عدد الآيات المحفوظة في كل جزء من نطاقات الطالب (تقاطع النطاقات بالترقيم العام) */
export function juzProgress(student: Student): JuzProgress[] {
  const ranges = student.memorized.map((r) => [ayahIndex(r.from), ayahIndex(r.to)] as const);
  return JUZ.map(({ juz }) => {
    const info = juzInfo(juz);
    const a = ayahIndex(info.from);
    const b = ayahIndex(info.to);
    let memorizedAyahs = 0;
    for (const [x, y] of ranges) {
      const lo = Math.max(a, x);
      const hi = Math.min(b, y);
      if (hi >= lo) memorizedAyahs += hi - lo + 1;
    }
    const percent = Math.round((memorizedAyahs / info.ayahs) * 100);
    const status: JuzStatus = memorizedAyahs === info.ayahs ? 'memorized' : memorizedAyahs > 0 ? 'in_progress' : 'not_started';
    return { ...info, memorizedAyahs, percent, status };
  });
}

export function memorizedTotal(student: Student) {
  return student.memorized.reduce((n, r) => n + countAyahs(r.from, r.to), 0);
}

export function attendanceRate(studentId: string) {
  const done = past([studentId]).filter((s) => s.status !== 'cancelled');
  if (!done.length) return 100;
  return Math.round((done.filter((s) => s.status === 'completed').length / done.length) * 100);
}
