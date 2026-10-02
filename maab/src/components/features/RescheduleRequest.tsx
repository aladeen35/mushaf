'use client';

import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api, errorText, IS_LIVE } from '@/lib/api';

/** ردّ ولي الأمر على طلب إعادة جدولة من المعلمة — قبول أو رفض كما في الإشعارات */
export function RescheduleRequest({ requestId, compact }: { requestId?: string; compact?: boolean }) {
  const router = useRouter();
  const [answer, setAnswer] = useState<'accepted' | 'rejected'>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const decide = async (accept: boolean) => {
    if (IS_LIVE && requestId) {
      setBusy(true);
      setError(undefined);
      try {
        await api(`/reschedule-requests/${requestId}/decide`, { body: { accept } });
        router.refresh();
      } catch (e) {
        setError(errorText(e));
        setBusy(false);
        return;
      }
    }
    setAnswer(accept ? 'accepted' : 'rejected');
  };

  if (answer) {
    return (
      <p className={answer === 'accepted' ? 'text-xs font-bold text-success' : 'text-xs font-bold text-danger'}>
        {answer === 'accepted' ? 'قبلتِ الموعد الجديد، وأُبلغت المعلمة.' : 'رفضتِ الطلب، وتبقى الحصة في موعدها.'}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className={compact ? 'flex gap-2' : 'grid grid-cols-2 gap-2'}>
        <Button size="xs" variant="success" disabled={busy} onClick={() => decide(true)} className={compact ? 'w-24' : ''}>
          <Check className="size-3.5" strokeWidth={3} aria-hidden />
          قبول
        </Button>
        <Button size="xs" variant="danger" disabled={busy} onClick={() => decide(false)} className={compact ? 'w-24' : ''}>
          <X className="size-3.5" strokeWidth={3} aria-hidden />
          رفض
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
