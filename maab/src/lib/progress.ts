// حسابات التقدّم من بيانات الطالب نفسها، مشتركة بين بيانات العرض والقاعدة.
import { mastery } from './domain/mastery';
import { ayahIndex, countAyahs, JUZ, juzInfo, type JuzInfo } from './quran';
import type { Range, Report, Segment, Student } from './types';

export const segmentAyahs = (s: Range) => countAyahs(s.from, s.to);
export const segmentMastery = (s: Segment) => mastery(s.mistakes);

/** متوسط الإتقان في التقرير موزوناً بعدد آيات كل مقطع */
export function reportMastery(r: Report): number {
  const total = r.segments.reduce((n, s) => n + segmentAyahs(s), 0);
  if (!total) return 0;
  const sum = r.segments.reduce((n, s) => n + segmentMastery(s) * segmentAyahs(s), 0);
  return Math.round((sum / total) * 10) / 10;
}

export type JuzStatus = 'memorized' | 'in_progress' | 'not_started';

export type JuzProgress = JuzInfo & { memorizedAyahs: number; percent: number; status: JuzStatus };

/** عدد الآيات المحفوظة في كل جزء من نطاقات الطالب (تقاطع النطاقات بالترقيم العام) */
export function juzProgress(student: Pick<Student, 'memorized'>): JuzProgress[] {
  const ranges = mergeRanges(student.memorized.map((r) => [ayahIndex(r.from), ayahIndex(r.to)] as [number, number]));
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

/** نطاقات متداخلة (حفظ ثم مراجعة للمقطع نفسه) تُدمج فلا تُعدّ الآية مرتين */
export function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function memorizedTotal(student: Pick<Student, 'memorized'>) {
  return mergeRanges(student.memorized.map((r) => [ayahIndex(r.from), ayahIndex(r.to)])).reduce((n, [a, b]) => n + b - a + 1, 0);
}
