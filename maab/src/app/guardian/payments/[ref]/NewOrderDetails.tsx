'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LeaderRow } from '@/components/ui/Card';
import { DURATIONS, plan, PLANS, type Duration, type PlanId } from '@/lib/domain/billing';
import { formatMoney, type Currency } from '@/lib/domain/market';

type Props = { kids: { id: string; fullName: string }[]; prices: Record<PlanId, Partial<Record<Duration, number>>>; currency: Currency };

/** نسخة العرض: تفاصيل الطلب الجديد من رابط صفحة الحجز */
function Details({ kids, prices, currency }: Props) {
  const sp = useSearchParams();
  const planId = (PLANS.some((p) => p.id === sp.get('plan')) ? sp.get('plan') : 'regular') as PlanId;
  const d = Number(sp.get('duration'));
  const duration = (DURATIONS.includes(d as Duration) ? d : 45) as Duration;
  const child = kids.find((k) => k.id === sp.get('child')) ?? kids[0];
  const amount = Number(sp.get('amount')) || prices[planId][duration] || 0;
  return (
    <>
      <LeaderRow label="الطالب" value={child?.fullName ?? '—'} />
      <LeaderRow label="الباقة" value={`${plan(planId).name} · ${duration} دقيقة`} />
      <LeaderRow label="المبلغ" value={formatMoney(amount, currency)} />
    </>
  );
}

export function NewOrderDetails(props: Props) {
  return (
    <Suspense fallback={<LeaderRow label="الطالب" value="…" />}>
      <Details {...props} />
    </Suspense>
  );
}
