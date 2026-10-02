'use client';

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/** ردّ ولي الأمر على طلب إعادة جدولة من المعلمة — قبول أو رفض كما في الإشعارات */
export function RescheduleRequest({ compact }: { compact?: boolean }) {
  const [answer, setAnswer] = useState<'accepted' | 'rejected'>();
  if (answer) {
    return (
      <p className={answer === 'accepted' ? 'text-xs font-bold text-success' : 'text-xs font-bold text-danger'}>
        {answer === 'accepted' ? 'قبلتِ الموعد الجديد، وأُبلغت المعلمة.' : 'رفضتِ الطلب، وتبقى الحصة في موعدها.'}
      </p>
    );
  }
  return (
    <div className={compact ? 'flex gap-2' : 'grid grid-cols-2 gap-2'}>
      <Button size="xs" variant="success" onClick={() => setAnswer('accepted')} className={compact ? 'w-24' : ''}>
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        قبول
      </Button>
      <Button size="xs" variant="danger" onClick={() => setAnswer('rejected')} className={compact ? 'w-24' : ''}>
        <X className="size-3.5" strokeWidth={3} aria-hidden />
        رفض
      </Button>
    </div>
  );
}
