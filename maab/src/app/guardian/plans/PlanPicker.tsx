'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { PillRadio } from '@/components/ui/Choice';
import { cn } from '@/lib/cn';
import { DURATIONS, PLAN_VALIDITY_DAYS, PLANS, type Duration, type PlanId } from '@/lib/domain/billing';
import { formatMoney, type Currency } from '@/lib/domain/market';

const PER_WEEK = ['', 'مرة أسبوعيًا', 'مرتين أسبوعيًا', 'ثلاث مرات أسبوعيًا'];
const ROLLOVER = ['', 'حتى حصة واحدة', 'حتى حصتين', 'حتى 3 حصص'];

export function PlanPicker({
  child,
  prices,
  currency,
  current,
}: {
  child: string;
  prices: Record<PlanId, Record<Duration, number>>;
  currency: Currency;
  current?: PlanId;
}) {
  const [duration, setDuration] = useState<Duration>(45);
  const [planId, setPlanId] = useState<PlanId>(current ?? 'regular');

  return (
    <div className="space-y-5">
      <PillRadio
        name="duration"
        legend="مدة الحصة"
        value={String(duration) as `${Duration}`}
        onChange={(v) => setDuration(Number(v) as Duration)}
        options={DURATIONS.map((d) => ({ value: String(d) as `${Duration}`, label: `${d} دقيقة` }))}
      />

      <div role="radiogroup" aria-label="الباقة" className="space-y-3">
        {PLANS.map((p) => {
          const on = p.id === planId;
          const price = prices[p.id][duration];
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlanId(p.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-card bg-card p-4 text-start shadow-card ring-1 transition',
                on ? 'ring-2 ring-brand' : 'ring-line hover:ring-brand/40',
              )}
            >
              {p.id === 'regular' && (
                <span className="absolute end-0 top-0 rounded-es-ctl bg-gold px-3 py-1 text-[11px] font-bold text-brand-deep">الأكثر اختيارًا</span>
              )}
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2', on ? 'border-brand bg-brand text-on-brand' : 'border-line')}
                >
                  {on && <Check className="size-3.5" strokeWidth={3.5} />}
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold text-ink">{p.name}</span>
                  <span className="block text-sm text-muted">
                    {p.sessions} حصص · {PER_WEEK[p.perWeek]}
                  </span>
                </span>
                <span className="text-end">
                  <span className="tabular block text-xl font-bold text-brand">{formatMoney(price, currency)}</span>
                  <span className="tabular block text-[11px] text-muted">{formatMoney(Math.round(price / p.sessions), currency)} للحصة</span>
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-3 text-xs text-muted">
                <li>صالحة {PLAN_VALIDITY_DAYS} يومًا من التفعيل</li>
                <li>الترحيل للشهر التالي {ROLLOVER[p.rollover]}</li>
                <li>معلمة ثابتة لطالب واحد</li>
                <li>تقرير حفظ بعد كل حصة</li>
              </ul>
            </button>
          );
        })}
      </div>

      <ButtonLink href={`/guardian/plans/checkout?child=${child}&plan=${planId}&duration=${duration}`} block>
        متابعة لاختيار الأوقات
      </ButtonLink>
    </div>
  );
}
