import { describe, expect, it } from 'vitest';
import { addDays, localParts, offsetMinutes, weekdayOf, zonedToUtc } from './tz';

describe('المناطق الزمنية', () => {
  it('الرياض والخرطوم بلا توقيت صيفي', () => {
    expect(zonedToUtc('2026-10-04', '17:30', 'Asia/Riyadh').toISOString()).toBe('2026-10-04T14:30:00.000Z');
    expect(zonedToUtc('2026-10-04', '17:30', 'Africa/Khartoum').toISOString()).toBe('2026-10-04T15:30:00.000Z');
  });

  it('لندن صيفاً وشتاءً', () => {
    expect(zonedToUtc('2026-07-01', '18:00', 'Europe/London').toISOString()).toBe('2026-07-01T17:00:00.000Z');
    expect(zonedToUtc('2026-12-01', '18:00', 'Europe/London').toISOString()).toBe('2026-12-01T18:00:00.000Z');
    expect(offsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Europe/London')).toBe(60);
  });

  it('يوم تغيّر التوقيت في نيويورك', () => {
    // 8 مارس 2026: تقدّم الساعة من 2:00 إلى 3:00
    expect(zonedToUtc('2026-03-08', '10:00', 'America/New_York').toISOString()).toBe('2026-03-08T14:00:00.000Z');
    expect(zonedToUtc('2026-03-07', '10:00', 'America/New_York').toISOString()).toBe('2026-03-07T15:00:00.000Z');
  });

  it('أجزاء الوقت المحلي ويوم الأسبوع', () => {
    const p = localParts(new Date('2026-10-04T21:30:00Z'), 'Asia/Riyadh');
    expect(p).toEqual({ date: '2026-10-05', time: '00:30', weekday: 1, minutes: 30 });
    expect(weekdayOf('2026-10-04')).toBe(0);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});
