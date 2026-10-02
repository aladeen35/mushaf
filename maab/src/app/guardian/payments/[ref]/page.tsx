import { Check, Clock, Download, FileText, Landmark, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Button } from '@/components/ui/Button';
import { Card, LeaderRow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { CopyButton } from '@/components/ui/CopyButton';
import { cn } from '@/lib/cn';
import { dataset, IS_LIVE, LIVE_PROBE } from '@/lib/data';
import { demoDataset } from '@/lib/data/demo';
import { DEMO_NEXT_REF } from '@/lib/demo/data';
import { holdExpiresAt, PAYMENT_STATUS, plan, REFERENCE_PATTERN, type PaymentStatus } from '@/lib/domain/billing';
import { formatMoney, PAYMENT_METHODS, paymentMethodsFor } from '@/lib/domain/market';
import { dayKey, fmtDayMonth, fmtTime } from '@/lib/format';
import type { Payment } from '@/lib/types';
import { NewOrderDetails } from './NewOrderDetails';
import { ReceiptUpload } from './ReceiptUpload';

export const metadata: Metadata = { title: 'الدفع بالتحويل' };

const STEPS: { status: PaymentStatus; label: string }[] = [
  { status: 'awaiting_transfer', label: 'بانتظار التحويل' },
  { status: 'under_review', label: 'بانتظار المراجعة' },
  { status: 'approved', label: 'معتمد' },
];

// النسخة الثابتة تبني صفحات طلبات العرض مسبقاً، ومعها الطلب الذي يُنشأ من صفحة الحجز
export function generateStaticParams() {
  return IS_LIVE ? [{ ref: LIVE_PROBE }] : [...demoDataset.payments.map((p) => ({ ref: p.ref })), { ref: DEMO_NEXT_REF }];
}

export default async function PaymentPage({ params }: PageProps<'/guardian/payments/[ref]'>) {
  const { ref } = await params;
  const d = await dataset('guardian');
  if (!REFERENCE_PATTERN.test(ref)) notFound();
  const at = d.now();

  // في نسخة العرض: الطلب الذي أُنشئ للتو من صفحة الحجز ولم يُرسل إيصاله بعد
  const fresh = d.mode === 'demo' && ref === DEMO_NEXT_REF;
  const found = d.getPayment(ref);
  if (!found && !fresh) notFound();
  const currency = d.guardian.currency;
  const payment: Payment = found ?? {
    ref,
    studentId: d.childrenOf()[0]?.id ?? '',
    plan: 'regular',
    duration: 45,
    amount: d.PRICES[currency].regular[45] ?? 0,
    currency,
    method: paymentMethodsFor(currency)[0],
    status: 'awaiting_transfer',
    createdAt: at.toISOString(),
  };
  const account = d.PAYMENT_ACCOUNTS.find((a) => a.method === payment.method);
  const student = d.getStudent(payment.studentId);
  const st = PAYMENT_STATUS[payment.status];
  const stepIdx = STEPS.findIndex((s) => s.status === (payment.status === 'needs_fix' ? 'awaiting_transfer' : payment.status));
  const expires = payment.holdExpiresAt ? new Date(payment.holdExpiresAt) : holdExpiresAt(new Date(payment.createdAt));
  const canUpload = payment.status === 'awaiting_transfer' || payment.status === 'needs_fix';

  return (
    <>
      <WaveHeader title={PAYMENT_METHODS[payment.method].label} back="/guardian/payments" className="pb-20">
        <div className="pb-2 text-center">
          <p className="text-xs text-on-hero/75">الرقم المرجعي — اكتبيه في خانة الملاحظات عند التحويل</p>
          <div className="mt-2 inline-flex items-center gap-3 rounded-ctl bg-white/10 px-4 py-2 ring-1 ring-gold/50">
            <span dir="ltr" className="tabular font-mono text-lg font-bold tracking-wide text-gold">
              {payment.ref}
            </span>
            <CopyButton value={payment.ref} label="الرقم المرجعي" className="bg-white/12 text-on-hero hover:bg-white/20" />
          </div>
        </div>
      </WaveHeader>

      <Page className="-mt-12">
        <Card className="p-4">
          <ol className="flex items-start" aria-label="حالة الطلب">
            {STEPS.map((s, i) => {
              const done = stepIdx > i || payment.status === 'approved';
              const active = stepIdx === i && payment.status !== 'approved';
              return (
                <li key={s.status} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                  {i > 0 && <span aria-hidden className={cn('absolute end-1/2 top-4 h-0.5 w-full', stepIdx >= i ? 'bg-brand' : 'bg-line')} />}
                  <span
                    className={cn(
                      'relative grid size-8 place-items-center rounded-full border-2 text-xs font-bold',
                      done && 'border-brand bg-brand text-on-brand',
                      active && 'border-gold bg-card text-gold-text',
                      !done && !active && 'border-line bg-card text-muted',
                    )}
                  >
                    {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : active ? <Clock className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn('text-[11px] font-bold', done || active ? 'text-ink' : 'text-muted')}>{s.label}</span>
                </li>
              );
            })}
          </ol>
          {(payment.status === 'rejected' || payment.status === 'needs_fix') && (
            <p className="mt-4 flex items-start gap-2 rounded-ctl bg-danger/8 p-3 text-sm text-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              {payment.reason ?? 'يحتاج الإيصال تصحيحًا، ارفعي إيصالًا جديدًا على الطلب نفسه.'}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold text-ink">تفاصيل الطلب</p>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          {fresh ? (
            <NewOrderDetails
              kids={d.childrenOf().map((k) => ({ id: k.id, fullName: k.fullName }))}
              prices={d.PRICES[currency]}
              currency={currency}
            />
          ) : (
            <>
              <LeaderRow label="الطالب" value={student?.fullName ?? '—'} />
              <LeaderRow label="الباقة" value={`${plan(payment.plan).name} · ${payment.duration} دقيقة`} />
              <LeaderRow label="المبلغ" value={formatMoney(payment.amount, payment.currency)} />
            </>
          )}
          {canUpload && <LeaderRow label="آخر موعد للتحويل" value={`${fmtDayMonth(expires)} ${fmtTime(expires)}`} />}
        </Card>

        {canUpload && account && (
          <>
            <Card className="space-y-3 p-4">
              <p className="flex items-center gap-2 font-bold text-ink">
                <Landmark className="size-5 text-gold-text" aria-hidden />
                بيانات الحساب
                {d.mode === 'demo' && <Badge tone="neutral">تجريبية</Badge>}
              </p>
              {account.instructions && <p className="text-xs leading-5 text-muted">{account.instructions}</p>}
              {[
                ['البنك', account.bankName],
                ['اسم المستفيد', account.accountName],
                ['رقم الحساب', account.accountNumber],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-ctl bg-field px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-muted">{k}</span>
                    <span dir={k === 'رقم الحساب' ? 'ltr' : undefined} className="tabular block truncate text-sm font-bold text-ink">
                      {v}
                    </span>
                  </span>
                  <CopyButton value={v} label={k} />
                </div>
              ))}
            </Card>
            <Card className="p-4">
              <p className="mb-3 font-bold text-ink">بعد التحويل</p>
              <ReceiptUpload orderRef={payment.ref} today={dayKey(at)} />
            </Card>
          </>
        )}

        {payment.receipt && (
          <Card className="flex items-center gap-3 p-4">
            <span className="grid size-11 place-items-center rounded-ctl bg-brand/8 text-brand" aria-hidden>
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">{payment.receipt.fileName}</span>
              <span className="block text-xs text-muted">
                {payment.receipt.senderName} · أُرسل {fmtDayMonth(new Date(payment.receipt.uploadedAt))} {fmtTime(new Date(payment.receipt.uploadedAt))}
              </span>
            </span>
          </Card>
        )}

        {payment.status === 'under_review' && (
          <p className="text-center text-sm leading-6 text-muted">
            تراجع المالية الإيصال، وتُفعَّل الباقة وتُنشأ الحصص وروابطها فور الاعتماد.
          </p>
        )}
        {payment.status === 'approved' && (
          <Button variant="secondary" block>
            <Download className="size-5" aria-hidden />
            تنزيل الإيصال الرقمي (PDF)
          </Button>
        )}
      </Page>
    </>
  );
}
