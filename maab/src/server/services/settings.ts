// إعدادات الأكاديمية من جدول settings (تغيّرها الإدارة دون نشر جديد)، مع قيم
// افتراضية مطابقة لقواعد المجال إن غاب المفتاح.
import { eq, inArray } from 'drizzle-orm';
import { MAX_BOY_AGE } from '@/lib/domain/students';
import { DEFAULT_WEIGHTS, MEMORIZED_THRESHOLD, type MasteryWeights } from '@/lib/domain/mastery';
import { BUFFER_MIN, FREE_CANCEL_HOURS, REPORT_DEADLINE_HOURS, SELF_RESCHEDULES_PER_MONTH } from '@/lib/domain/sessions';
import { PAYMENT_HOLD_HOURS } from '@/lib/domain/billing';
import type { Tx } from '../db/client';
import { featureFlags, settings } from '../db/schema';

export const DEFAULTS = {
  max_boy_age: MAX_BOY_AGE,
  mastery_weights: DEFAULT_WEIGHTS as MasteryWeights,
  memorized_threshold: MEMORIZED_THRESHOLD,
  free_cancel_hours: FREE_CANCEL_HOURS,
  self_reschedules_per_month: SELF_RESCHEDULES_PER_MONTH,
  join_window: { beforeMin: 10, afterMin: 15 },
  session_buffer_minutes: BUFFER_MIN,
  report_deadline_hours: REPORT_DEADLINE_HOURS,
  payment_hold_hours: PAYMENT_HOLD_HOURS,
  admin_idle_minutes: 30,
};

export type SettingKey = keyof typeof DEFAULTS;
export type Settings = typeof DEFAULTS;

export async function getSettings<K extends SettingKey>(tx: Tx, keys: K[]): Promise<Pick<Settings, K>> {
  const rows = await tx.select().from(settings).where(inArray(settings.key, keys));
  const out = {} as Pick<Settings, K>;
  for (const k of keys) out[k] = (rows.find((r) => r.key === k)?.value as Settings[K]) ?? DEFAULTS[k];
  return out;
}

export async function getSetting<K extends SettingKey>(tx: Tx, key: K): Promise<Settings[K]> {
  return (await getSettings(tx, [key]))[key];
}

export async function flagEnabled(tx: Tx, key: string): Promise<boolean> {
  const [row] = await tx.select({ enabled: featureFlags.enabled }).from(featureFlags).where(eq(featureFlags.key, key));
  return row?.enabled ?? false;
}
