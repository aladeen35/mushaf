import type { Metadata } from 'next';
import { plan } from '@/lib/domain/billing';
import { pendingPayments } from '@/lib/demo/data';
import { now } from '@/lib/demo/queries';
import { arCount, fmtRelativeDay, fmtSAR, fmtTime } from '@/lib/format';
import { PaymentReview, type ReviewRow } from './PaymentReview';

export const metadata: Metadata = { title: 'التحويلات' };

export default function AdminPayments() {
  const at = now();
  const rows: ReviewRow[] = [...pendingPayments]
    .sort((a, b) => Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt))
    .map((p) => ({
      ref: p.ref,
      payer: p.payer,
      student: p.student,
      plan: `${plan(p.plan).name} · ${p.duration} د`,
      amount: fmtSAR(p.amount),
      uploaded: `رُفع ${fmtRelativeDay(new Date(p.uploadedAt), at)} ${fmtTime(new Date(p.uploadedAt))}`,
      file: p.file,
      senderName: p.senderName,
    }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">التحويلات بانتظار المراجعة</h1>
        <p className="mt-1 text-sm text-muted">
          {arCount(rows.length, ['إيصال واحد', 'إيصالان', 'إيصالات', 'إيصالًا'])} · الأقدم أولًا · كل قرار يُسجَّل في سجل التدقيق
        </p>
      </div>
      <PaymentReview rows={rows} />
      <p className="text-xs leading-5 text-muted">
        الاعتماد يفعّل الباقة وينشئ الحصص وروابط Meet ويصدر إيصالًا رقميًا. لا يُعدَّل سجل الدفع بعد إنشائه، والاسترداد حركة عكسية مستقلة.
      </p>
    </>
  );
}
