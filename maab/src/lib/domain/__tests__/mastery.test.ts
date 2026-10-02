import { describe, expect, it } from 'vitest';
import { isMemorized, mastery, MEMORIZED_THRESHOLD, NO_MISTAKES, suggestGrade } from '../mastery';

describe('نسبة الإتقان', () => {
  it('100 بلا أخطاء', () => {
    expect(mastery(NO_MISTAKES)).toBe(100);
  });

  it('3 لكل خطأ حفظ و1 لكل تجويد أو تشكيل و0.5 لكل تردد', () => {
    expect(mastery({ hifz: 2, tajweed: 1, tashkeel: 1, hesitation: 3 })).toBe(100 - 6 - 1 - 1 - 1.5);
  });

  it('لا تنزل تحت الصفر', () => {
    expect(mastery({ hifz: 40, tajweed: 0, tashkeel: 0, hesitation: 0 })).toBe(0);
  });

  it('المقطع تحت 70% لا يُحتسب محفوظاً', () => {
    expect(MEMORIZED_THRESHOLD).toBe(70);
    expect(isMemorized({ hifz: 10, tajweed: 0, tashkeel: 0, hesitation: 0 })).toBe(true); // 70 بالضبط
    expect(isMemorized({ hifz: 10, tajweed: 0, tashkeel: 0, hesitation: 1 })).toBe(false); // 69.5
  });

  it('يرفض الأعداد السالبة والكسور', () => {
    expect(() => mastery({ hifz: -1, tajweed: 0, tashkeel: 0, hesitation: 0 })).toThrow();
    expect(() => mastery({ hifz: 1.5, tajweed: 0, tashkeel: 0, hesitation: 0 })).toThrow();
  });

  it('يقترح التقدير من النسبة', () => {
    expect(suggestGrade(95)).toBe('excellent');
    expect(suggestGrade(85)).toBe('very_good');
    expect(suggestGrade(70)).toBe('good');
    expect(suggestGrade(69.5)).toBe('needs_repeat');
  });
});
