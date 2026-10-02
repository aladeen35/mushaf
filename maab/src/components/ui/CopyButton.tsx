'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`نسخ ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value.replace(/\s/g, ''));
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition',
        done ? 'bg-success/12 text-success' : 'bg-brand/8 text-brand hover:bg-brand/14',
        className,
      )}
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {done ? 'نُسخ' : 'نسخ'}
    </button>
  );
}
