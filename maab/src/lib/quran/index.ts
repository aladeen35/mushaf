// جدول المرجع (القسم 9): السور والأجزاء وحساب المقادير من نطاق الآيات مباشرة.
import juzData from './juz.json';
import surahsData from './surahs.json';

export type Surah = { id: number; name: string; ayahs: number; place: string; startPage: number };
export type AyahRef = { surah: number; ayah: number };
export type Juz = { juz: number; surah: number; ayah: number; page: number; pageStart: boolean };

export const SURAHS: Surah[] = surahsData;
export const JUZ: Juz[] = juzData;
export const TOTAL_AYAHS = 6236;
export const TOTAL_PAGES = 604;

// OFFSETS[i] = عدد الآيات قبل السورة i+1
const OFFSETS = SURAHS.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SURAHS[i - 1].ayahs);
  return acc;
}, []);

export function surah(id: number): Surah {
  const s = SURAHS[id - 1];
  if (!s) throw new RangeError(`سورة غير موجودة: ${id}`);
  return s;
}

export function isValidRef({ surah: s, ayah: a }: AyahRef): boolean {
  return Number.isInteger(s) && Number.isInteger(a) && s >= 1 && s <= 114 && a >= 1 && a <= SURAHS[s - 1].ayahs;
}

/** رقم الآية في المصحف كله (1–6236) */
export function ayahIndex(ref: AyahRef): number {
  if (!isValidRef(ref)) throw new RangeError(`آية غير صحيحة: ${ref.surah}:${ref.ayah}`);
  return OFFSETS[ref.surah - 1] + ref.ayah;
}

export function fromIndex(index: number): AyahRef {
  if (!Number.isInteger(index) || index < 1 || index > TOTAL_AYAHS) throw new RangeError(`رقم آية خارج المصحف: ${index}`);
  let lo = 0;
  let hi = OFFSETS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (OFFSETS[mid] < index) lo = mid;
    else hi = mid - 1;
  }
  return { surah: lo + 1, ayah: index - OFFSETS[lo] };
}

/**
 * عدد الآيات في نطاق شامل لطرفيه. نهاية النطاق يجب ألا تسبق بدايته
 * (قيد «نطاق المقطع صالح» في القسم 13) — والاتجاه من الناس إلى البقرة
 * يُسجَّل مقطعاً مقطعاً، فكل مقطع بذاته يُقرأ بترتيب المصحف.
 */
export function countAyahs(from: AyahRef, to: AyahRef): number {
  const a = ayahIndex(from);
  const b = ayahIndex(to);
  if (b < a) throw new RangeError('نهاية المقطع قبل بدايته');
  return b - a + 1;
}

export function juzOf(ref: AyahRef): number {
  const i = ayahIndex(ref);
  let j = 1;
  for (const z of JUZ) if (ayahIndex(z) <= i) j = z.juz;
  return j;
}

export type JuzInfo = {
  juz: number;
  from: AyahRef;
  to: AyahRef;
  ayahs: number;
  startPage: number;
  endPage: number;
  pages: number;
  surahs: number[];
};

export function juzInfo(juz: number): JuzInfo {
  const z = JUZ[juz - 1];
  if (!z) throw new RangeError(`جزء غير موجود: ${juz}`);
  const next = JUZ[juz];
  const start = ayahIndex(z);
  const end = next ? ayahIndex(next) - 1 : TOTAL_AYAHS;
  const to = fromIndex(end);
  const endPage = next ? (next.pageStart ? next.page - 1 : next.page) : TOTAL_PAGES;
  const surahs: number[] = [];
  for (let s = z.surah; s <= to.surah; s++) surahs.push(s);
  return {
    juz,
    from: { surah: z.surah, ayah: z.ayah },
    to,
    ayahs: end - start + 1,
    startPage: z.page,
    endPage,
    pages: endPage - z.page + 1,
    surahs,
  };
}

/** «البقرة 1–10» أو «البقرة 200 – آل عمران 10» */
export function formatRange(from: AyahRef, to: AyahRef): string {
  if (from.surah === to.surah) {
    return from.ayah === to.ayah
      ? `${surah(from.surah).name} ${from.ayah}`
      : `${surah(from.surah).name} ${from.ayah}–${to.ayah}`;
  }
  return `${surah(from.surah).name} ${from.ayah} – ${surah(to.surah).name} ${to.ayah}`;
}

/** رقم الآية بالأرقام العربية المشرقية داخل علامة نهاية الآية */
export function ayahMark(n: number): string {
  return `۝${n.toLocaleString('ar-SA-u-nu-arab', { useGrouping: false })}`;
}
