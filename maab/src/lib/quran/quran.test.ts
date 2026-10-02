import { describe, expect, it } from 'vitest';
import ayahs from './ayahs.json';
import { ayahIndex, countAyahs, formatRange, fromIndex, juzInfo, juzOf, SURAHS, TOTAL_AYAHS } from './index';
import { searchKey } from './search';

describe('جدول الآيات المرجعي', () => {
  it('6236 آية في 114 سورة', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.ayahs, 0)).toBe(TOTAL_AYAHS);
    expect(ayahs).toHaveLength(TOTAL_AYAHS);
  });

  it('الترقيم العام ذهاباً وإياباً', () => {
    expect(ayahIndex({ surah: 1, ayah: 1 })).toBe(1);
    expect(ayahIndex({ surah: 2, ayah: 1 })).toBe(8);
    expect(ayahIndex({ surah: 114, ayah: 6 })).toBe(6236);
    for (const i of [1, 7, 8, 293, 294, 3000, 6236]) expect(ayahIndex(fromIndex(i))).toBe(i);
  });

  it('يحسب المقدار من النطاق ويرفض النطاق المقلوب أو الآية غير الموجودة', () => {
    expect(countAyahs({ surah: 2, ayah: 200 }, { surah: 3, ayah: 10 })).toBe(87 + 10);
    expect(() => countAyahs({ surah: 3, ayah: 10 }, { surah: 2, ayah: 200 })).toThrow();
    expect(() => ayahIndex({ surah: 1, ayah: 8 })).toThrow();
  });

  it('الأجزاء: الثلاثون من النبأ، والرابع يبدأ وسط الصفحة 62', () => {
    expect(juzOf({ surah: 78, ayah: 1 })).toBe(30);
    expect(juzOf({ surah: 3, ayah: 92 })).toBe(3);
    expect(juzOf({ surah: 3, ayah: 93 })).toBe(4);
    const j30 = juzInfo(30);
    expect([j30.startPage, j30.endPage, j30.surahs.length, j30.ayahs]).toEqual([582, 604, 37, 564]);
    expect(juzInfo(3).endPage).toBe(62);
    expect(juzInfo(1).pages).toBe(21);
    expect(Array.from({ length: 30 }, (_, i) => juzInfo(i + 1).ayahs).reduce((a, b) => a + b, 0)).toBe(TOTAL_AYAHS);
  });

  it('صياغة النطاق', () => {
    expect(formatRange({ surah: 2, ayah: 1 }, { surah: 2, ayah: 10 })).toBe('البقرة 1–10');
    expect(formatRange({ surah: 2, ayah: 200 }, { surah: 3, ayah: 10 })).toBe('البقرة 200 – آل عمران 10');
  });
});

describe('البحث في نص المصحف', () => {
  it('مفتاح البحث في البيانات مولَّد بالدالة نفسها', () => {
    for (const i of [0, 262, 3000, 6235]) expect(ayahs[i][4]).toBe(searchKey(ayahs[i][3] as string));
  });
  it('يطابق الإملاء المعتاد رسمَ المصحف', () => {
    const key = (s: number, a: number) => ayahs.find((x) => x[0] === s && x[1] === a)![4] as string;
    expect(key(2, 256)).toContain(searchKey('الطاغوت'));
    expect(key(2, 3)).toContain(searchKey('الصلاة'));
    expect(key(1, 3)).toContain(searchKey('الرحمن الرحيم'));
  });
});
