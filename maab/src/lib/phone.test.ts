import { describe, expect, it } from 'vitest';
import { normalizeSaudiMobile } from './phone';

describe('رقم الجوال السعودي', () => {
  it('يقبل الصيغ الشائعة', () => {
    for (const v of ['512345678', '0512345678', '+966512345678', '00966512345678', '051 234 5678', '٠٥١٢٣٤٥٦٧٨']) {
      expect(normalizeSaudiMobile(v)).toBe('512345678');
    }
  });
  it('يرفض غير الجوال', () => {
    for (const v of ['112345678', '51234567', '5123456789', 'abc', '']) expect(normalizeSaudiMobile(v)).toBeNull();
  });
});
