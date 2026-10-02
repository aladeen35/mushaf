// تحويل المواعيد بين المناطق الزمنية دون مكتبة: ولي الأمر في الرياض أو
// الخرطوم أو لندن يختار الوقت بتوقيته، والمعلمة تُتاح بتوقيتها، والقاعدة UTC.

const MIN = 60_000;
const DAY = 86_400_000;

const parts = (tz: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });

const formatters = new Map<string, Intl.DateTimeFormat>();
const fmt = (tz: string) => {
  let f = formatters.get(tz);
  if (!f) formatters.set(tz, (f = parts(tz)));
  return f;
};

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type LocalParts = { date: string; time: string; weekday: number; minutes: number };

/** التاريخ والوقت واليوم كما تراه منطقة زمنية معينة لحظةً ما */
export function localParts(at: Date, tz: string): LocalParts {
  const p = Object.fromEntries(fmt(tz).formatToParts(at).map((x) => [x.type, x.value]));
  const hh = p.hour === '24' ? '00' : p.hour;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${hh}:${p.minute}`,
    weekday: WEEKDAYS[p.weekday],
    minutes: Number(hh) * 60 + Number(p.minute),
  };
}

/** فرق المنطقة عن UTC بالدقائق في لحظة معينة (الرياض +180، لندن صيفاً +60) */
export function offsetMinutes(at: Date, tz: string): number {
  const p = Object.fromEntries(fmt(tz).formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === '24' ? 0 : +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MIN);
}

/** «2026-10-04 17:30 بتوقيت الخرطوم» ← لحظة UTC، مع مراعاة التوقيت الصيفي */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = naive - offsetMinutes(new Date(naive), tz) * MIN;
  // تكرار ثانٍ يصحّح الحالات التي يقع فيها الموعد بعد تغيّر التوقيت مباشرة
  guess = naive - offsetMinutes(new Date(guess), tz) * MIN;
  return new Date(guess);
}

/** إضافة أيام لتاريخ نصي YYYY-MM-DD */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

/** يوم الأسبوع لتاريخ نصي (0 = الأحد) */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** هل المنطقة الزمنية معروفة للمتصفح والخادم؟ */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
