import type { Metadata } from 'next';
import { ChildTabs, pickChild } from '@/components/features/ChildTabs';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { LOW_BALANCE, plan } from '@/lib/domain/billing';
import { guardian, PRICES } from '@/lib/demo/data';
import { childrenOf } from '@/lib/demo/queries';
import { arCount, fmtDayMonth, SESSIONS } from '@/lib/format';
import { PlanPicker } from './PlanPicker';

export const metadata: Metadata = { title: 'الباقات' };

export default async function Plans({ searchParams }: PageProps<'/guardian/plans'>) {
  const { child: childParam } = await searchParams;
  const kids = childrenOf();
  const child = pickChild(kids, childParam);
  const sub = child.subscription;
  const used = sub.total - sub.remaining;

  return (
    <>
      <WaveHeader title="الباقات" back="/guardian/account">
        <div className="flex justify-center pt-1 pb-2">
          <ChildTabs items={kids} active={child.id} base="/guardian/plans" />
        </div>
      </WaveHeader>
      <Page className="-mt-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink">
              الباقة الحالية: {plan(sub.plan).name} · {sub.duration} دقيقة
            </p>
            <Badge tone={sub.remaining <= LOW_BALANCE ? 'warning' : 'success'}>
              بقي {arCount(sub.remaining, SESSIONS)}
            </Badge>
          </div>
          <ProgressBar value={(used / sub.total) * 100} label="الحصص المستخدمة" className="mt-3" tone="gold" />
          <p className="mt-2 text-xs text-muted">
            استُخدمت {used} من {sub.total} · تنتهي الصلاحية {fmtDayMonth(new Date(sub.expiresAt))} · الأيام: {sub.days.join(' و')} {sub.time}
          </p>
        </Card>

        <p className="text-sm leading-6 text-muted">
          الباقة رصيد حصص لطالب واحد صالح 30 يومًا، ولا تُفعَّل إلا بعد اعتماد المالية للتحويل. يمكن شراء أكثر من باقة لأكثر من طالب في طلب واحد.
        </p>

        <PlanPicker child={child.id} prices={PRICES[guardian.currency]} currency={guardian.currency} current={sub.plan} />
        <p className="text-center text-[11px] text-muted">الأسعار المعروضة تجريبية، وتحدّدها الإدارة من لوحة التحكم.</p>
      </Page>
    </>
  );
}
