// المراجعة التلقائية المتباعدة (القسم 9): بعد يوم، 3 أيام، أسبوع، أسبوعين، شهر.

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

const DAY = 86_400_000;

export function reviewDates(memorizedAt: Date): Date[] {
  return REVIEW_INTERVALS_DAYS.map((d) => new Date(memorizedAt.getTime() + d * DAY));
}

/** المراجعات المستحقة حتى تاريخ معين لمقاطع مختلفة، الأقدم أولاً */
export function dueReviews<T extends { memorizedAt: Date; reviewsDone: number }>(segments: T[], now: Date): T[] {
  return segments
    .filter((s) => {
      if (s.reviewsDone >= REVIEW_INTERVALS_DAYS.length) return false;
      const due = s.memorizedAt.getTime() + REVIEW_INTERVALS_DAYS[s.reviewsDone] * DAY;
      return due <= now.getTime();
    })
    .sort((a, b) => a.memorizedAt.getTime() - b.memorizedAt.getTime());
}
