import { describe, expect, it } from 'vitest';
import { allCountries, country, currencyFor, formatMoney, otpChannels, paymentMethodsFor } from '../market';

describe('السوق', () => {
  it('العملة حسب الدولة', () => {
    expect(currencyFor('SA')).toBe('SAR');
    expect(currencyFor('SD')).toBe('SDG');
    expect(currencyFor('AE')).toBe('USD');
    expect(currencyFor('GB')).toBe('USD');
  });
  it('السودان أولاً ثم السعودية، وكل الدول متاحة بأسمائها العربية', () => {
    const list = allCountries();
    expect(list[0].code).toBe('SD');
    expect(list[1].code).toBe('SA');
    expect(country('SD')).toMatchObject({ name: 'السودان', dial: '+249', tz: 'Africa/Khartoum' });
    expect(list.length).toBeGreaterThan(200);
    expect(new Set(list.map((c) => c.code)).size).toBe(list.length);
  });
  it('طرق الدفع اليدوية لكل عملة في الإطلاق', () => {
    expect(paymentMethodsFor('SAR')).toEqual(['bank_transfer_sa']);
    expect(paymentMethodsFor('SDG')).toEqual(['sudan_transfer']);
    expect(paymentMethodsFor('USD')).toEqual(['international_transfer']);
  });
  it('واتساب أولاً للجميع، وSMS احتياطاً للسعودية فقط، والبريد لغيرها', () => {
    expect(otpChannels('SA')).toEqual(['whatsapp', 'sms']);
    expect(otpChannels('SD')).toEqual(['whatsapp', 'email']);
    expect(otpChannels('GB')).toEqual(['whatsapp', 'email']);
  });
  it('صياغة المبالغ', () => {
    expect(formatMoney(460, 'SAR')).toBe('460 ر.س');
    expect(formatMoney(45000, 'SDG')).toBe('45,000 ج.س');
    expect(formatMoney(120, 'USD')).toBe('120 دولار');
  });
});
