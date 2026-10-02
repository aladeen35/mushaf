// من يُقبل طالباً (القسم 1): الأطفال والنساء، والتدريس بمعلمات فقط.

/** قرار الإدارة: يُقبل الأولاد حتى 12 سنة (كانت القيمة المؤقتة في المواصفات 10) */
export const MAX_BOY_AGE = 12;
export const MIN_AGE = 4;
/** من بلغت 18 تُسند إلى معلمات النساء، ومن دونها إلى معلمات الأطفال */
export const ADULT_AGE = 18;

export type Gender = 'female' | 'male';

export type Eligibility = { ok: true } | { ok: false; reason: 'too_young' | 'boy_too_old' };

export function eligibility(gender: Gender, age: number, maxBoyAge = MAX_BOY_AGE): Eligibility {
  if (age < MIN_AGE) return { ok: false, reason: 'too_young' };
  if (gender === 'male' && age > maxBoyAge) return { ok: false, reason: 'boy_too_old' };
  return { ok: true };
}

export function teacherCategory(age: number): 'children' | 'women' {
  return age >= ADULT_AGE ? 'women' : 'children';
}
