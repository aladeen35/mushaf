'use client';

import { Check, ExternalLink, FileText, PencilLine, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api, errorText, IS_LIVE, newKey } from '@/lib/api';
import { PAYMENT_STATUS, requiresReason, type PaymentStatus } from '@/lib/domain/billing';

export type ReviewRow = {
  /** معرّف الدفعة والإيصال في القاعدة (النسخة الحية) */
  id?: string;
  fileId?: string;
  ref: string;
  payer: string;
  student: string;
  plan: string;
  amount: string;
  uploaded: string;
  file: string;
  senderName: string;
};

/** مراجعة التحويلات: الاعتماد يفعّل الباقة، والرفض أو التصحيح يتطلب سببًا يُرسل للمستخدم */
export function PaymentReview({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, PaymentStatus>>({});
  const [pending, setPending] = useState<{ ref: string; to: PaymentStatus }>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<{ ref: string; text: string }>();

  /** القرار في الخادم: الاعتماد بمفتاح منع تكرار، والرفض والتصحيح بسبب يصل للمستخدم */
  const commit = async (ref: string, to: PaymentStatus, why?: string) => {
    const row = rows.find((r) => r.ref === ref);
    if (IS_LIVE && row?.id) {
      setBusy(ref);
      setError(undefined);
      try {
        if (to === 'approved') await api(`/payments/${row.id}/approve`, { method: 'POST', idempotencyKey: newKey() });
        else await api(`/payments/${row.id}/reject`, { body: { reason: why, needsFix: to === 'needs_fix' } });
        router.refresh();
      } catch (e) {
        setError({ ref, text: errorText(e) });
        setBusy(undefined);
        return false;
      }
      setBusy(undefined);
    }
    setStatus((s) => ({ ...s, [ref]: to }));
    return true;
  };

  const decide = (ref: string, to: PaymentStatus) => {
    if (requiresReason(to)) {
      setReason('');
      setPending({ ref, to });
    } else void commit(ref, to);
  };

  const openReceipt = async (fileId: string) => {
    const { url } = await api<{ url: string }>(`/files/${fileId}`);
    window.open(url, '_blank', 'noopener');
  };

  return (
    <>
      <div className="overflow-hidden rounded-card bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="hidden bg-field text-xs text-muted md:table-header-group">
            <tr>
              <th className="px-4 py-3 text-start font-semibold">المرجع</th>
              <th className="px-4 py-3 text-start font-semibold">الدافع والطالب</th>
              <th className="px-4 py-3 text-start font-semibold">الباقة</th>
              <th className="px-4 py-3 text-start font-semibold">المبلغ</th>
              <th className="px-4 py-3 text-start font-semibold">الإيصال</th>
              <th className="px-4 py-3 text-start font-semibold">القرار</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const st = status[r.ref];
              return (
                <tr key={r.ref} className="grid grid-cols-2 gap-x-3 gap-y-2 p-4 md:table-row md:p-0">
                  <td className="col-span-2 md:px-4 md:py-3">
                    <span dir="ltr" className="tabular font-mono text-xs font-bold text-ink">
                      {r.ref}
                    </span>
                    <span className="block text-[11px] text-muted">{r.uploaded}</span>
                  </td>
                  <td className="md:px-4 md:py-3">
                    <span className="block font-bold text-ink">{r.payer}</span>
                    <span className="block text-xs text-muted">لـ{r.student}</span>
                  </td>
                  <td className="text-muted md:px-4 md:py-3">{r.plan}</td>
                  <td className="tabular font-bold text-ink md:px-4 md:py-3">{r.amount}</td>
                  <td className="md:px-4 md:py-3">
                    <span className="flex items-center gap-2 text-xs">
                      <FileText className="size-4 shrink-0 text-gold-text" aria-hidden />
                      <span className="min-w-0">
                        {IS_LIVE && r.fileId ? (
                          <button type="button" onClick={() => openReceipt(r.fileId!)} className="flex items-center gap-1 font-semibold text-brand underline-offset-4 hover:underline">
                            {r.file} <ExternalLink className="size-3" aria-hidden />
                          </button>
                        ) : (
                          <span className="block truncate font-semibold text-ink">{r.file}</span>
                        )}
                        <span className="block truncate text-muted">{r.senderName}</span>
                      </span>
                    </span>
                  </td>
                  <td className="col-span-2 md:px-4 md:py-3">
                    {st ? (
                      <Badge tone={PAYMENT_STATUS[st].tone}>{PAYMENT_STATUS[st].label}</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="xs" variant="success" disabled={busy === r.ref} onClick={() => decide(r.ref, 'approved')}>
                          <Check className="size-3.5" strokeWidth={3} aria-hidden />
                          اعتماد
                        </Button>
                        <Button size="xs" variant="soft" disabled={busy === r.ref} onClick={() => decide(r.ref, 'needs_fix')}>
                          <PencilLine className="size-3.5" aria-hidden />
                          تصحيح
                        </Button>
                        <Button size="xs" variant="danger" disabled={busy === r.ref} onClick={() => decide(r.ref, 'rejected')}>
                          <X className="size-3.5" strokeWidth={3} aria-hidden />
                          رفض
                        </Button>
                        {error?.ref === r.ref && <p className="w-full text-xs text-danger">{error.text}</p>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!pending}
        onClose={() => setPending(undefined)}
        title={pending?.to === 'rejected' ? 'رفض التحويل' : 'طلب تصحيح الإيصال'}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!pending || reason.trim().length < 5) return;
            if (await commit(pending.ref, pending.to, reason.trim())) setPending(undefined);
          }}
        >
          <p dir="ltr" className="tabular text-center font-mono text-sm text-muted">
            {pending?.ref}
          </p>
          <TextArea
            id="reason"
            label="السبب (يُرسل للمستخدم)"
            placeholder="مثال: المبلغ في الإيصال لا يطابق مبلغ الطلب"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
          />
          {error && pending && error.ref === pending.ref && <p className="text-sm text-danger">{error.text}</p>}
          <Button type="submit" block disabled={reason.trim().length < 5 || busy === pending?.ref}>
            إرسال القرار
          </Button>
        </form>
      </Modal>
    </>
  );
}
