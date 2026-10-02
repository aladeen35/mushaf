'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

/** النسخة الحية: يسجّل الدخول في الخادم ثم يفتح Meet، أو يعرض سبب المنع */
export function JoinRedirect({ id }: { id: string }) {
  const [error, setError] = useState<string>();
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/sessions/${id}/join`, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && json?.data?.url) window.location.replace(json.data.url);
        else setError(json?.message_ar ?? 'تعذّر الدخول للحصة، حاولي بعد قليل');
      })
      .catch(() => alive && setError('تعذّر الاتصال، تأكدي من الإنترنت'));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!error) return null;
  return (
    <p className="flex items-start gap-2 rounded-ctl bg-danger/8 p-3 text-start text-sm text-ink">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      {error}
    </p>
  );
}
