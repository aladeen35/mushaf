import { describe, expect, it } from 'vitest';
import { applyCoupon, canTransition, holdExpiresAt, paymentReference, PLANS, REFERENCE_PATTERN, requiresReason } from '../billing';
import { canMoveApplication, shouldSuspend } from '../teachers';
import { dueReviews, reviewDates } from '../review';

describe('الرقم المرجعي للتحويل', () => {
  it('بصيغة MAAB-2026-000123', () => {
    expect(paymentReference(2026, 123)).toBe('MAAB-2026-000123');
    expect(REFERENCE_PATTERN.test(paymentReference(2026, 999_999))).toBe(true);
  });
  it('يرفض التسلسل خارج المدى', () => {
    expect(() => paymentReference(2026, 0)).toThrow();
    expect(() => paymentReference(2026, 1_000_000)).toThrow();
  });
});

describe('الباقات', () => {
  it('أساسية 4 ومنتظمة 8 ومكثفة 12 حصة، والترحيل حتى 1 و2 و3', () => {
    expect(PLANS.map((p) => [p.sessions, p.perWeek, p.rollover])).toEqual([
      [4, 1, 1],
      [8, 2, 2],
      [12, 3, 3],
    ]);
  });
  it('الطلب غير المدفوع يُلغى بعد 72 ساعة', () => {
    expect(holdExpiresAt(new Date('2026-10-01T09:00:00Z')).toISOString()).toBe('2026-10-04T09:00:00.000Z');
  });
  it('الكوبون نسبة أو مبلغ ثابت ولا ينزل عن الصفر', () => {
    expect(applyCoupon(400, { type: 'percent', value: 15 })).toBe(340);
    expect(applyCoupon(400, { type: 'fixed', value: 500 })).toBe(0);
  });
});

describe('حالات التحويل', () => {
  it('المعتمد لا يُعدَّل، والرفض يتطلب سبباً', () => {
    expect(canTransition('under_review', 'approved')).toBe(true);
    expect(canTransition('approved', 'rejected')).toBe(false);
    expect(canTransition('awaiting_transfer', 'approved')).toBe(false);
    expect(requiresReason('rejected')).toBe(true);
    expect(requiresReason('approved')).toBe(false);
  });
});

describe('قبول المعلمات', () => {
  it('لا قبول دون مقابلة تسميع', () => {
    expect(canMoveApplication('under_review', 'accepted')).toBe(false);
    expect(canMoveApplication('interview', 'accepted')).toBe(true);
    expect(canMoveApplication('needs_info', 'under_review')).toBe(true);
  });
  it('ثلاث غيابات دون عذر في شهر توقف المعلمة', () => {
    expect(shouldSuspend(2)).toBe(false);
    expect(shouldSuspend(3)).toBe(true);
  });
});

describe('المراجعة المتباعدة', () => {
  const t = new Date('2026-10-01T12:00:00Z');
  it('بعد يوم و3 أيام وأسبوع وأسبوعين وشهر', () => {
    expect(reviewDates(t).map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-10-02',
      '2026-10-04',
      '2026-10-08',
      '2026-10-15',
      '2026-10-31',
    ]);
  });
  it('تُستحق المراجعة التالية حسب عدد ما أُنجز', () => {
    const segs = [
      { id: 'a', memorizedAt: t, reviewsDone: 1 }, // مستحقة 10-04
      { id: 'b', memorizedAt: t, reviewsDone: 2 }, // مستحقة 10-08
      { id: 'c', memorizedAt: t, reviewsDone: 5 }, // انتهت
    ];
    expect(dueReviews(segs, new Date('2026-10-05T00:00:00Z')).map((s) => s.id)).toEqual(['a']);
  });
});
