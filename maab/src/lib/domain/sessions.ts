// قواعد الحصة: نافذة الدخول، الفاصل بين الحصص، وأثر الإلغاء والغياب على الرصيد (القسم 7).

const MIN = 60_000;
const HOUR = 60 * MIN;

/** زر «ادخل الحصة» يظهر قبل الموعد بـ10 دقائق ويختفي بعد نهايته بـ15 دقيقة */
export const JOIN_OPENS_BEFORE_MIN = 10;
export const JOIN_CLOSES_AFTER_MIN = 15;
/** فاصل إلزامي بين حصص المعلمة */
export const BUFFER_MIN = 5;
/** مهلة الإلغاء المجاني وإعادة الجدولة */
export const FREE_CANCEL_HOURS = 12;
/** ولي الأمر يعيد الجدولة بنفسه حتى مرتين في الشهر */
export const SELF_RESCHEDULES_PER_MONTH = 2;
/** مهلة كتابة تقرير الحصة */
export const REPORT_DEADLINE_HOURS = 12;
/** تأخّر المعلمة الذي يُعدّ غياباً يستحق التعويض */
export const TEACHER_LATE_LIMIT_MIN = 10;

export type JoinState = 'upcoming' | 'open' | 'closed';

export function joinWindow(startsAt: Date, durationMin: number) {
  return {
    opensAt: new Date(startsAt.getTime() - JOIN_OPENS_BEFORE_MIN * MIN),
    closesAt: new Date(startsAt.getTime() + (durationMin + JOIN_CLOSES_AFTER_MIN) * MIN),
  };
}

export function joinState(now: Date, startsAt: Date, durationMin: number): JoinState {
  const { opensAt, closesAt } = joinWindow(startsAt, durationMin);
  if (now < opensAt) return 'upcoming';
  if (now > closesAt) return 'closed';
  return 'open';
}

export type Slot = { start: Date; end: Date };

/**
 * هل يتعارض موعدان مع احترام الفاصل؟ هذا فحص الواجهة فقط؛ المنع الفعلي
 * في قاعدة البيانات بقيد EXCLUDE على (teacher_id, tstzrange) مع الفاصل.
 */
export function overlaps(a: Slot, b: Slot, bufferMin = BUFFER_MIN): boolean {
  const pad = bufferMin * MIN;
  return a.start.getTime() < b.end.getTime() + pad && b.start.getTime() < a.end.getTime() + pad;
}

/** تأخّر المعلمة يُعامل معاملة الغياب إذا تجاوز 10 دقائق */
export function teacherCountsAbsent(lateMinutes: number): boolean {
  return lateMinutes > TEACHER_LATE_LIMIT_MIN;
}

export function hoursUntil(now: Date, at: Date): number {
  return (at.getTime() - now.getTime()) / HOUR;
}

export function canSelfReschedule(now: Date, startsAt: Date, usedThisMonth: number): boolean {
  return hoursUntil(now, startsAt) >= FREE_CANCEL_HOURS && usedThisMonth < SELF_RESCHEDULES_PER_MONTH;
}

export function reportDueAt(endsAt: Date): Date {
  return new Date(endsAt.getTime() + REPORT_DEADLINE_HOURS * HOUR);
}

export type AbsenceCase =
  | { kind: 'guardian_cancel'; hoursBefore: number }
  | { kind: 'student_no_show' }
  | { kind: 'excused_absence' }
  /** غياب المعلمة أو تأخّرها أكثر من 10 دقائق — انظر teacherCountsAbsent */
  | { kind: 'teacher_absent' }
  | { kind: 'technical_outage' };

export type BalanceEffect = {
  /** هل تُخصم الحصة من رصيد الباقة؟ */
  deduct: boolean;
  /** ما يُسجَّل للحصة */
  outcome: string;
  /** الإجراء التالي */
  action: string;
  /** هل تُحتسب على انضباط المعلمة؟ */
  countsAgainstTeacher: boolean;
};

/** جدول القسم 7 كما هو: كل حالة وما يحدث للرصيد والإجراء */
export function balanceEffect(c: AbsenceCase): BalanceEffect {
  switch (c.kind) {
    case 'guardian_cancel':
      return c.hoursBefore >= FREE_CANCEL_HOURS
        ? {
            deduct: false,
            outcome: 'إلغاء في المهلة',
            action: 'يختار موعدًا بديلًا ضمن صلاحية الباقة',
            countsAgainstTeacher: false,
          }
        : { deduct: true, outcome: 'غياب الطالب', action: 'تُخصم الحصة وتُسجَّل غيابًا', countsAgainstTeacher: false };
    case 'student_no_show':
      return { deduct: true, outcome: 'غياب الطالب', action: 'تُخصم الحصة وتُسجَّل غيابًا', countsAgainstTeacher: false };
    case 'excused_absence':
      return { deduct: false, outcome: 'غياب بعذر', action: 'استثناء يدوي مع سبب', countsAgainstTeacher: false };
    case 'teacher_absent':
      return {
        deduct: false,
        outcome: 'غياب المعلمة',
        action: 'حصة تعويضية إلزامية',
        countsAgainstTeacher: true,
      };
    case 'technical_outage':
      return { deduct: false, outcome: 'انقطاع تقني', action: 'تعويض بقرار الدعم', countsAgainstTeacher: false };
  }
}
