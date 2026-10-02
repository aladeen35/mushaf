// الباقات والتحويل البنكي (القسم 6). الأسعار تُحدَّد من لوحة الإدارة ولا تُكتب هنا.

export type PlanId = 'basic' | 'regular' | 'intensive';

export type PlanTier = {
  id: PlanId;
  name: string;
  sessions: number;
  perWeek: number;
  /** أقصى عدد حصص مؤجّلة تُرحَّل للشهر التالي */
  rollover: number;
};

export const PLANS: PlanTier[] = [
  { id: 'basic', name: 'أساسية', sessions: 4, perWeek: 1, rollover: 1 },
  { id: 'regular', name: 'منتظمة', sessions: 8, perWeek: 2, rollover: 2 },
  { id: 'intensive', name: 'مكثفة', sessions: 12, perWeek: 3, rollover: 3 },
];

export const DURATIONS = [30, 45, 60] as const;
export type Duration = (typeof DURATIONS)[number];

export const PLAN_VALIDITY_DAYS = 30;
/** الطلب غير المدفوع يُلغى وتتحرّر أوقاته بعد 72 ساعة */
export const PAYMENT_HOLD_HOURS = 72;
/** رصيد منخفض: يُنبَّه ولي الأمر عند حصتين أو أقل */
export const LOW_BALANCE = 2;

export const plan = (id: PlanId) => PLANS.find((p) => p.id === id)!;

export const REFERENCE_PATTERN = /^MAAB-(\d{4})-(\d{6})$/;

/** رقم مرجعي فريد بتسلسل سنوي: MAAB-2026-000123 */
export function paymentReference(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) throw new RangeError('سنة غير صحيحة');
  if (!Number.isInteger(seq) || seq < 1 || seq > 999_999) throw new RangeError('تسلسل خارج المدى');
  return `MAAB-${year}-${String(seq).padStart(6, '0')}`;
}

export function holdExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + PAYMENT_HOLD_HOURS * 3_600_000);
}

export type PaymentStatus = 'awaiting_transfer' | 'under_review' | 'approved' | 'rejected' | 'needs_fix' | 'expired';

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: 'gold' | 'warning' | 'success' | 'danger' | 'neutral' }> = {
  awaiting_transfer: { label: 'بانتظار التحويل', tone: 'gold' },
  under_review: { label: 'بانتظار المراجعة', tone: 'warning' },
  approved: { label: 'معتمد', tone: 'success' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  needs_fix: { label: 'يحتاج تصحيح', tone: 'warning' },
  expired: { label: 'ملغى لعدم الدفع', tone: 'neutral' },
};

/** مسار الحالة المسموح: الرفض أو طلب التصحيح يتطلب سبباً يُرسل للمستخدم */
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  awaiting_transfer: ['under_review', 'expired'],
  under_review: ['approved', 'rejected', 'needs_fix'],
  needs_fix: ['under_review', 'expired'],
  approved: [],
  rejected: [],
  expired: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export const requiresReason = (to: PaymentStatus) => to === 'rejected' || to === 'needs_fix';

/** مبلغ الطلب بعد الكوبون: نسبة أو مبلغ ثابت، ولا ينزل عن الصفر */
export function applyCoupon(amount: number, coupon?: { type: 'percent' | 'fixed'; value: number }): number {
  if (!coupon) return amount;
  const off = coupon.type === 'percent' ? (amount * coupon.value) / 100 : coupon.value;
  return Math.max(0, Math.round((amount - off) * 100) / 100);
}
