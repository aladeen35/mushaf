'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, IS_LIVE } from '@/lib/api';

export function MarkAllRead({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled || done}
      className="text-xs font-bold text-brand disabled:text-muted"
      onClick={async () => {
        if (IS_LIVE) {
          await api('/notifications/read', { body: { all: true } }).catch(() => undefined);
          router.refresh();
        }
        setDone(true);
      }}
    >
      {done ? 'كلها مقروءة' : 'تحديد الكل كمقروء'}
    </button>
  );
}
