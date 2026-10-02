'use client';

import { Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { arCount } from '@/lib/format';

type Item = { text: string; count: number; virtue?: string };

/** عدّاد لكل ذكر يُحفظ محليًا أثناء الجلسة؛ الذكر المكتمل يُطوى بعلامة */
export function AzkarList({ items }: { items: Item[] }) {
  const [done, setDone] = useState<number[]>(() => items.map(() => 0));
  const finished = done.filter((d, i) => d >= items[i].count).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="tabular font-bold text-ink">
          {finished} من {items.length}
        </span>
        <button type="button" onClick={() => setDone(items.map(() => 0))} className="flex items-center gap-1 text-xs font-bold text-brand">
          <RotateCcw className="size-3.5" aria-hidden />
          من جديد
        </button>
      </div>
      {items.map((it, i) => {
        const complete = done[i] >= it.count;
        return (
          <button
            key={i}
            type="button"
            disabled={complete}
            onClick={() => setDone((d) => d.map((v, j) => (j === i ? v + 1 : v)))}
            className={cn(
              'block w-full rounded-card bg-card p-4 text-start shadow-card transition active:scale-[0.99]',
              complete && 'opacity-60',
            )}
            aria-label={`${it.text.slice(0, 40)}… ${done[i]} من ${it.count}`}
          >
            <p className="font-display text-lg leading-9 text-ink">{it.text}</p>
            {it.virtue && <p className="mt-2 border-s-2 border-gold ps-2 text-xs leading-5 text-muted">{it.virtue}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted">{it.count > 1 ? `يُقال ${arCount(it.count, ['مرة', 'مرتين', 'مرات', 'مرة'])}` : 'مرة واحدة'}</span>
              <span
                className={cn(
                  'tabular grid h-9 min-w-16 place-items-center rounded-full px-3 text-sm font-bold',
                  complete ? 'bg-success/14 text-success' : 'bg-brand text-on-brand',
                )}
              >
                {complete ? <Check className="size-4" strokeWidth={3} aria-hidden /> : `${done[i]} / ${it.count}`}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
