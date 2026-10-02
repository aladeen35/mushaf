import type { Metadata } from 'next';
import { plan } from '@/lib/domain/billing';
import { dataset } from '@/lib/data';
import { formatMoney } from '@/lib/domain/market';
import { arCount, fmtRelativeDay, fmtTime } from '@/lib/format';
import { PaymentReview, type ReviewRow } from './PaymentReview';

export const metadata: Metadata = { title: 'التحويلات' };

export default async function AdminPayments() {
  const d = await dataset('admin');
  const at = d.now();
  const rows: ReviewRow[] = [...d.pendingPayments]
    .sort((a, b) => Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt))
    .map((p) => ({
      id: p.id,
      fileId: p.fileId,
      ref: p.ref,
      payer: p.payer,
      student: p.student,
      plan: `${plan(p.plan).name} · ${p.duration} د`,
      amount: formatMoney(p.amount, p.currency),
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
      {rows.length ? <PaymentReview rows={rows} /> : <p className="rounded-card bg-card p-5 text-center text-sm text-muted shadow-card">ما في إيصالات بانتظار المراجعة.</p>}
      <p className="text-xs leading-5 text-muted">
        الاعتماد يفعّل الباقة وينشئ الحصص وروابط Meet ويصدر إيصالًا رقميًا. لا يُعدَّل سجل الدفع بعد إنشائه، والاسترداد حركة عكسية مستقلة.
      </p>
    </>
  );
}
