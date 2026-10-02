// مدخل الشاشات إلى البيانات: نسخة العرض تقرأ بيانات ثابتة، والنسخة الحية
// (NEXT_PUBLIC_MAAB_MODE=live) تقرأ من القاعدة بهوية المستخدم المسجّل.
// المتغير يُضمَّن وقت البناء، فلا يدخل كود الخادم في النسخة الثابتة.
import { setDisplayTimezone } from '../format';
import { demoDataset } from './demo';
import type { Dataset } from './queries';
import type { Section } from './types';

export type { Dataset } from './queries';
export type * from './types';

export const IS_LIVE = process.env.NEXT_PUBLIC_MAAB_MODE === 'live';

/**
 * مسار يُبنى في النسخة الحية من الصفحات ذات generateStaticParams: قراءة كوكيز
 * الجلسة أثناء بنائه تُعلم Next أن الصفحة ديناميكية، فتُعرض لكل مستخدم عند الطلب.
 * (قائمة فارغة تعني عرضاً ثابتاً عند أول زيارة، ولا كوكيز فيه.)
 */
export const LIVE_PROBE = '_';

export async function dataset(section: Section): Promise<Dataset> {
  if (process.env.NEXT_PUBLIC_MAAB_MODE === 'live') {
    const { liveDataset } = await import('../../server/dataset');
    return liveDataset(section);
  }
  setDisplayTimezone(demoDataset.guardian.timezone);
  return demoDataset;
}
