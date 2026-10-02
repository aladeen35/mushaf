// كل الأوقات تُخزَّن UTC وتُعرض بتوقيت المستخدم نفسه (القسم 7): ولي الأمر في
// الخرطوم يرى توقيت الخرطوم، وفي لندن توقيت لندن. التوقيت يُضبط مرة لكل طلب
// من طبقة البيانات، والافتراضي الرياض (توقيت نسخة العرض). الأرقام غربية كما
// في الواجهات المرجعية، والتاريخ ميلادي مع الهجري حيث يلزم.
import { cache } from 'react';

export const TZ = 'Asia/Riyadh';
const LOCALE = 'ar-SA-u-nu-latn-ca-gregory';

/** توقيت العرض لهذا الطلب (مخزن React لكل طلب على الخادم) */
const store = cache(() => ({ tz: TZ }));

export function setDisplayTimezone(tz: string) {
  store().tz = tz;
}

export function currentTz(): string {
  try {
    return store().tz;
  } catch {
    return TZ;
  }
}

type Kind = 'time' | 'weekday' | 'dayMonth' | 'fullDate' | 'hijri' | 'ymd' | 'hour';
const OPTIONS: Record<Kind, [string, Intl.DateTimeFormatOptions]> = {
  time: [LOCALE, { hour: 'numeric', minute: '2-digit' }],
  weekday: [LOCALE, { weekday: 'long' }],
  dayMonth: [LOCALE, { day: 'numeric', month: 'long' }],
  fullDate: [LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }],
  hijri: ['ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }],
  ymd: ['en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }],
  hour: ['en-US', { hour: 'numeric', hour12: false }],
};
const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(kind: Kind, tz = currentTz()): Intl.DateTimeFormat {
  const key = `${kind}|${tz}`;
  let f = formatters.get(key);
  if (!f) {
    const [locale, opts] = OPTIONS[kind];
    formatters.set(key, (f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz })));
  }
  return f;
}

export const fmtTime = (d: Date, tz?: string) => fmt('time', tz).format(d);
export const fmtWeekday = (d: Date, tz?: string) => fmt('weekday', tz).format(d);
export const fmtDayMonth = (d: Date, tz?: string) => fmt('dayMonth', tz).format(d);
export const fmtFullDate = (d: Date, tz?: string) => fmt('fullDate', tz).format(d);
export const fmtHijri = (d: Date, tz?: string) => fmt('hijri', tz).format(d);

/** مفتاح اليوم بتوقيت المستخدم: 2026-10-04 */
export const dayKey = (d: Date, tz?: string) => fmt('ymd', tz).format(d);

/** الساعة 0–23 بتوقيت المستخدم (للتحية صباحاً ومساءً) */
export const localHour = (d: Date, tz?: string) => Number(fmt('hour', tz).format(d)) % 24;

export function fmtRelativeDay(d: Date, now: Date): string {
  const diff = Math.round((Date.parse(dayKey(d)) - Date.parse(dayKey(now))) / 86_400_000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غدًا';
  if (diff === -1) return 'أمس';
  return fmtWeekday(d);
}

export function fmtTimeRange(start: Date, durationMin: number): string {
  return `${fmtTime(start)} – ${fmtTime(new Date(start.getTime() + durationMin * 60_000))}`;
}

/**
 * العدد مع المعدود على قواعد العربية: دقيقة، دقيقتان، 3–10 دقائق، 11+ دقيقة.
 * forms = [مفرد، مثنى، جمع 3–10، تمييز 11 فأكثر]
 */
export function arCount(n: number, forms: [string, string, string, string]): string {
  if (n === 1) return forms[0];
  if (n === 2) return forms[1];
  const tail = n % 100;
  if (tail >= 3 && tail <= 10) return `${n} ${forms[2]}`;
  return `${n} ${forms[3]}`;
}

export const MINUTES: [string, string, string, string] = ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'];
export const HOURS: [string, string, string, string] = ['ساعة', 'ساعتان', 'ساعات', 'ساعة'];
export const DAYS: [string, string, string, string] = ['يوم', 'يومان', 'أيام', 'يومًا'];
export const YEARS: [string, string, string, string] = ['سنة', 'سنتان', 'سنوات', 'سنة'];
export const AYAHS: [string, string, string, string] = ['آية واحدة', 'آيتان', 'آيات', 'آية'];
export const SESSIONS: [string, string, string, string] = ['حصة واحدة', 'حصتان', 'حصص', 'حصة'];

/** «31 آية» أو «7 آيات» — والواحدة والاثنتان بالرقم أيضاً حيث تُعرض كعدّاد */
export function fmtAyahs(n: number, numeric = false): string {
  if (numeric && n <= 2) return `${n} ${n === 1 ? 'آية' : 'آيتان'}`;
  return arCount(n, AYAHS);
}

/** «بعد 25 دقيقة» أو «بعد ساعتين» */
export function fmtIn(now: Date, at: Date): string {
  const min = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (min <= 0) return 'الآن';
  // «بعد» تجرّ ما بعدها فالمثنى بالياء
  const after = (s: string) => `بعد ${s.replace('دقيقتان', 'دقيقتين').replace('ساعتان', 'ساعتين').replace('يومان', 'يومين')}`;
  if (min < 60) return after(arCount(min, MINUTES));
  const h = Math.round(min / 60);
  if (h < 24) return after(arCount(h, HOURS));
  return after(arCount(Math.round(h / 24), DAYS));
}

export function ageFrom(birthDate: string, now: Date): number {
  const b = new Date(birthDate);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
