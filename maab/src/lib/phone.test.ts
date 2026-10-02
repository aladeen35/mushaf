import { describe, expect, it } from 'vitest';
import { displayPhone, parsePhone } from './phone';

describe('أرقام الجوال الدولية', () => {
  it('السعودية بصيغها الشائعة', () => {
    for (const v of ['512345678', '0512345678', '+966512345678', '00966512345678', '051 234 5678', '٠٥١٢٣٤٥٦٧٨']) {
      expect(parsePhone(v, 'SA')?.e164).toBe('+966512345678');
    }
  });
  it('السودان محلياً وبالمفتاح', () => {
    expect(parsePhone('0912345678', 'SD')?.e164).toBe('+249912345678');
    expect(parsePhone('+249 91 234 5678', 'SA')?.e164).toBe('+249912345678');
    expect(parsePhone('+249912345678', 'SA')?.country).toBe('SD');
  });
  it('رقم من دولة أخرى بالمفتاح يُقبل أيّاً كانت الدولة المختارة', () => {
    expect(parsePhone('+447400123456', 'SD')?.country).toBe('GB');
  });
  it('يرفض الأرقام غير الصحيحة', () => {
    for (const v of ['', 'abc', '123', '+9661234']) expect(parsePhone(v, 'SA')).toBeNull();
  });
  it('العرض الدولي', () => {
    expect(displayPhone('+249912345678')).toBe('+249 91 234 5678');
  });
});
