// حدّ الطلبات (القسم 15): 60 طلباً في الدقيقة لكل مستخدم. نافذة ثابتة في
// ذاكرة الخادم تكفي لنسخة واحدة؛ عند تشغيل أكثر من نسخة يُنقل العدّاد إلى
// Postgres أو Redis دون تغيير من يستدعيه. حدّ رمز الدخول مستقل في القاعدة.

type Bucket = { count: number; resetAt: number };

const store = (globalThis as unknown as { maabRate?: Map<string, Bucket> }).maabRate ?? new Map<string, Bucket>();
(globalThis as unknown as { maabRate?: Map<string, Bucket> }).maabRate = store;

let lastSweep = 0;

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, max: number, windowSec: number, now = Date.now()): RateResult {
  if (now - lastSweep > 60_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    lastSweep = now;
  }
  let b = store.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowSec * 1000 };
    store.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= max, remaining: Math.max(0, max - b.count), retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export const _resetRateLimits = () => store.clear();
