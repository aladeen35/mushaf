import { describe, expect, it } from 'vitest';
import { balanceEffect, canSelfReschedule, joinState, overlaps, reportDueAt, teacherCountsAbsent } from '../sessions';

const at = (iso: string) => new Date(iso);
// 17:00 بتوقيت الرياض = 14:00 UTC
const start = at('2026-10-04T14:00:00Z');

describe('نافذة الدخول للحصة', () => {
  it('يظهر الزر قبل الموعد بـ10 دقائق', () => {
    expect(joinState(at('2026-10-04T13:49:59Z'), start, 45)).toBe('upcoming');
    expect(joinState(at('2026-10-04T13:50:00Z'), start, 45)).toBe('open');
  });
  it('ويختفي بعد نهايتها بـ15 دقيقة', () => {
    expect(joinState(at('2026-10-04T15:00:00Z'), start, 45)).toBe('open');
    expect(joinState(at('2026-10-04T15:00:01Z'), start, 45)).toBe('closed');
  });
});

describe('منع التعارض مع فاصل 5 دقائق', () => {
  const a = { start, end: at('2026-10-04T14:45:00Z') };
  it('حصة تبدأ بعد 4 دقائق من نهاية أخرى تتعارض', () => {
    expect(overlaps(a, { start: at('2026-10-04T14:49:00Z'), end: at('2026-10-04T15:30:00Z') })).toBe(true);
  });
  it('وبعد 5 دقائق لا تتعارض', () => {
    expect(overlaps(a, { start: at('2026-10-04T14:50:00Z'), end: at('2026-10-04T15:30:00Z') })).toBe(false);
  });
});

describe('الغياب والرصيد (جدول القسم 7)', () => {
  it('إلغاء ولي الأمر قبل 12 ساعة أو أكثر يعيد الرصيد', () => {
    expect(balanceEffect({ kind: 'guardian_cancel', hoursBefore: 12 }).deduct).toBe(false);
  });
  it('الإلغاء المتأخر أو الغياب دون إشعار يخصم الحصة ويُسجَّل غياب الطالب', () => {
    const late = balanceEffect({ kind: 'guardian_cancel', hoursBefore: 11.9 });
    expect(late.deduct).toBe(true);
    expect(late.outcome).toBe('غياب الطالب');
    expect(balanceEffect({ kind: 'student_no_show' }).deduct).toBe(true);
  });
  it('غياب المعلمة لا يخصم ويوجب حصة تعويضية تُحتسب على انضباطها', () => {
    const e = balanceEffect({ kind: 'teacher_absent' });
    expect(e).toMatchObject({ deduct: false, action: 'حصة تعويضية إلزامية', countsAgainstTeacher: true });
  });
  it('تأخّر المعلمة أكثر من 10 دقائق يُعامل غياباً', () => {
    expect(teacherCountsAbsent(10)).toBe(false);
    expect(teacherCountsAbsent(11)).toBe(true);
  });
  it('الغياب بعذر والانقطاع التقني لا يخصمان', () => {
    expect(balanceEffect({ kind: 'excused_absence' }).deduct).toBe(false);
    expect(balanceEffect({ kind: 'technical_outage' }).deduct).toBe(false);
  });
});

describe('إعادة الجدولة والتقرير', () => {
  it('ولي الأمر يعيد الجدولة بنفسه حتى مرتين في الشهر ضمن مهلة 12 ساعة', () => {
    const now = at('2026-10-04T01:00:00Z');
    expect(canSelfReschedule(now, start, 1)).toBe(true);
    expect(canSelfReschedule(now, start, 2)).toBe(false);
    expect(canSelfReschedule(at('2026-10-04T03:00:01Z'), start, 0)).toBe(false);
  });
  it('مهلة التقرير 12 ساعة من نهاية الحصة', () => {
    expect(reportDueAt(at('2026-10-04T14:45:00Z')).toISOString()).toBe('2026-10-05T02:45:00.000Z');
  });
});
