import { describe, expect, it } from 'vitest';
import { eligibility, MAX_BOY_AGE, teacherCategory } from '../students';

describe('قبول الطلاب', () => {
  it('الأولاد حتى 12 سنة', () => {
    expect(MAX_BOY_AGE).toBe(12);
    expect(eligibility('male', 12)).toEqual({ ok: true });
    expect(eligibility('male', 13)).toEqual({ ok: false, reason: 'boy_too_old' });
  });
  it('البنات والنساء بلا حدّ أعلى، وأقل عمر 4 سنوات', () => {
    expect(eligibility('female', 40)).toEqual({ ok: true });
    expect(eligibility('female', 3)).toEqual({ ok: false, reason: 'too_young' });
  });
  it('الفئة: أطفال دون 18 ونساء من 18', () => {
    expect(teacherCategory(17)).toBe('children');
    expect(teacherCategory(18)).toBe('women');
  });
});
