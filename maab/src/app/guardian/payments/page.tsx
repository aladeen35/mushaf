import { ChevronLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { PAYMENT_STATUS, plan } from '@/lib/domain/billing';
import { dataset } from '@/lib/data';
import { formatMoney } from '@/lib/domain/market';
import { fmtDayMonth } from '@/lib/format';

export const metadata: Metadata = { title: 'المدفوعات' };

export default async function Payments() {
  const d = await dataset('guardian');
  const list = [...d.payments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <>
      <WaveHeader title="المدفوعات والإيصالات" back="/guardian/account" />
      <Page className="-mt-4">
        {!list.length && <Card className="p-4 text-sm text-muted">لسه ما في مدفوعات. تظهر هنا طلباتك وإيصالاتها.</Card>}
        <Card className="divide-y divide-line empty:hidden">
          {list.map((p) => {
            const st = PAYMENT_STATUS[p.status];
            return (
              <Link key={p.ref} href={`/guardian/payments/${p.ref}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-field">
                <span className="grid size-10 place-items-center rounded-ctl bg-brand/8 text-brand" aria-hidden>
                  <Receipt className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {plan(p.plan).name} · {d.getStudent(p.studentId)?.name}
                  </span>
                  <span dir="ltr" className="tabular block text-end text-xs text-muted">
                    {p.ref}
                  </span>
                </span>
                <span className="text-end">
                  <span className="tabular block text-sm font-bold text-ink">{formatMoney(p.amount, p.currency)}</span>
                  <span className="block text-[11px] text-muted">{fmtDayMonth(new Date(p.createdAt))}</span>
                </span>
                <Badge tone={st.tone}>{st.label}</Badge>
                <ChevronLeft className="size-4 text-muted" aria-hidden />
              </Link>
            );
          })}
        </Card>
        <p className="px-1 text-xs leading-5 text-muted">
          كل عملية دفع تُحفظ بسجل كامل لا يُحذف. الاسترداد يُسجَّل حركةً عكسية مستقلة ولا يُعدِّل الطلب الأصلي.
        </p>
      </Page>
    </>
  );
}
