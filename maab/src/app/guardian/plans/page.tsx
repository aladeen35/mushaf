import type { Metadata } from 'next';
import { ChildPanels, ChildTabs } from '@/components/features/ChildTabs';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/Progress';
import { dataset, type Dataset } from '@/lib/data';
import { LOW_BALANCE, plan } from '@/lib/domain/billing';
import { arCount, fmtDayMonth, SESSIONS } from '@/lib/format';
import type { Student } from '@/lib/types';
import { PlanPicker } from './PlanPicker';

export const metadata: Metadata = { title: 'الباقات' };

export default async function Plans() {
  const d = await dataset('guardian');
  const kids = d.childrenOf();
  return (
    <>
      <WaveHeader title="الباقات" back="/guardian/account">
        <div className="flex justify-center pt-1 pb-2">
          <ChildTabs items={kids} base="/guardian/plans" />
        </div>
      </WaveHeader>
      <Page className="-mt-6">
        {kids.length ? (
          <ChildPanels panels={Object.fromEntries(kids.map((k) => [k.id, <ChildPlans key={k.id} d={d} child={k} />]))} />
        ) : (
          <Card className="p-4 text-sm text-muted">أضيفي ابنكِ أولاً ثم اختاري له باقة.</Card>
        )}
      </Page>
    </>
  );
}

function ChildPlans({ d, child }: { d: Dataset; child: Student }) {
  const sub = child.subscription;
  const used = sub ? sub.total - sub.remaining : 0;
  const currency = d.guardian.currency;
  return (
    <div className="space-y-6">
      {sub ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink">
              الباقة الحالية: {plan(sub.plan).name} · {sub.duration} دقيقة
            </p>
            <Badge tone={sub.remaining <= LOW_BALANCE ? 'warning' : 'success'}>بقي {arCount(sub.remaining, SESSIONS)}</Badge>
          </div>
          <ProgressBar value={sub.total ? (used / sub.total) * 100 : 0} label="الحصص المستخدمة" className="mt-3" tone="gold" />
          <p className="mt-2 text-xs text-muted">
            استُخدمت {used} من {sub.total} · تنتهي الصلاحية {fmtDayMonth(new Date(sub.expiresAt))}
            {sub.days.length > 0 && ` · الأيام: ${sub.days.join(' و')} ${sub.time}`}
          </p>
        </Card>
      ) : (
        <Card className="p-4 text-sm leading-7 text-muted">لا باقة لـ{child.name} بعد. اختاري الباقة والمدة، ثم المعلمة والأوقات.</Card>
      )}

      <p className="text-sm leading-6 text-muted">
        الباقة رصيد حصص لطالب واحد صالح 30 يومًا، ولا تُفعَّل إلا بعد اعتماد المالية للتحويل. الأسعار بعملة بلدك، وتحدّدها الإدارة.
      </p>

      <PlanPicker child={child.id} prices={d.PRICES[currency]} currency={currency} current={sub?.plan} />
      {d.mode === 'demo' && <p className="text-center text-[11px] text-muted">الأسعار المعروضة تجريبية، وتحدّدها الإدارة من لوحة التحكم.</p>}
    </div>
  );
}
