// نسبة الإتقان والتقدير (القسم 9). الأوزان قيمة أولى قابلة للتعديل من الإعدادات.

export type Mistakes = {
  /** أخطاء الحفظ */
  hifz: number;
  tajweed: number;
  tashkeel: number;
  /** التردد */
  hesitation: number;
};

export type MasteryWeights = Record<keyof Mistakes, number>;

export const DEFAULT_WEIGHTS: MasteryWeights = { hifz: 3, tajweed: 1, tashkeel: 1, hesitation: 0.5 };

/** المقطع تحت هذه النسبة لا يُحتسب محفوظاً ويعود في الواجب */
export const MEMORIZED_THRESHOLD = 70;

export const NO_MISTAKES: Mistakes = { hifz: 0, tajweed: 0, tashkeel: 0, hesitation: 0 };

export function mastery(m: Mistakes, w: MasteryWeights = DEFAULT_WEIGHTS): number {
  for (const k of Object.keys(m) as (keyof Mistakes)[]) {
    if (!Number.isInteger(m[k]) || m[k] < 0) throw new RangeError(`عدد أخطاء غير صحيح: ${k}`);
  }
  const penalty = m.hifz * w.hifz + m.tajweed * w.tajweed + m.tashkeel * w.tashkeel + m.hesitation * w.hesitation;
  return Math.max(0, 100 - penalty);
}

export function isMemorized(m: Mistakes, w?: MasteryWeights): boolean {
  return mastery(m, w) >= MEMORIZED_THRESHOLD;
}

export function totalMistakes(m: Mistakes): number {
  return m.hifz + m.tajweed + m.tashkeel + m.hesitation;
}

export type Grade = 'excellent' | 'very_good' | 'good' | 'needs_repeat';

export const GRADES: { value: Grade; label: string }[] = [
  { value: 'excellent', label: 'ممتاز' },
  { value: 'very_good', label: 'جيد جدًا' },
  { value: 'good', label: 'جيد' },
  { value: 'needs_repeat', label: 'يحتاج إعادة' },
];

export const gradeLabel = (g: Grade) => GRADES.find((x) => x.value === g)!.label;

/** التقدير المقترح من النسبة؛ تعدّله المعلمة إن رأت غيره */
export function suggestGrade(pct: number): Grade {
  if (pct >= 90) return 'excellent';
  if (pct >= 80) return 'very_good';
  if (pct >= MEMORIZED_THRESHOLD) return 'good';
  return 'needs_repeat';
}
