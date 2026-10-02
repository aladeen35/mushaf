'use client';

import { ChevronDown, Copy, KeyRound, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { api, errorText } from '@/lib/api';
import { cn } from '@/lib/cn';

export type ChildItem = {
  id: string;
  name: string;
  meta: string;
  teacher: string;
  plan: string;
  balance: string;
  next: string;
  /** رمز العرض، أو '' لإصداره من الخادم، أو null لمن لا يحتاجه */
  code: string | null;
};

/** قائمة الأبناء: اختيار بزر راديو وتفاصيل تنسدل، ثم «انتقل» — كقائمة الطلاب في المرجع */
export function ChildrenPicker({ items }: { items: ChildItem[] }) {
  const [selected, setSelected] = useState(items[0]?.id);
  const [open, setOpen] = useState<string | undefined>(items[0]?.id);
  const [revealed, setRevealed] = useState<string>();
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const issue = async (id: string) => {
    setError(undefined);
    try {
      const { code } = await api<{ code: string }>(`/students/${id}/login-code`, { method: 'POST' });
      setIssued((m) => ({ ...m, [id]: code }));
      setRevealed(id);
    } catch (e) {
      setError(errorText(e));
    }
  };
  const current = items.find((c) => c.id === selected);

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="اختيار الابن" className="space-y-3">
        {items.map((c) => {
          const isOpen = open === c.id;
          const isSel = selected === c.id;
          return (
            <div key={c.id} className="flex items-start gap-3">
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                aria-label={c.name}
                onClick={() => setSelected(c.id)}
                className={cn(
                  'mt-4 grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
                  isSel ? 'border-brand' : 'border-line bg-card',
                )}
              >
                {isSel && <span className="size-3 rounded-full bg-brand" />}
              </button>

              <div className={cn('min-w-0 flex-1 rounded-card bg-card shadow-card transition', isSel && 'ring-1 ring-brand/30')}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? undefined : c.id);
                    setSelected(c.id);
                  }}
                  className="flex h-15 w-full items-center gap-3 px-4 text-start"
                >
                  <span className="grid size-9 place-items-center rounded-full border border-line text-brand" aria-hidden>
                    <UserRound className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{c.name}</span>
                    <span className="block text-xs text-muted">{c.meta}</span>
                  </span>
                  <ChevronDown className={cn('size-5 text-muted transition', isOpen && 'rotate-180 text-brand')} aria-hidden />
                </button>

                {isOpen && (
                  <div className="space-y-2 px-3 pb-3">
                    {[
                      ['المعلمة', c.teacher],
                      ['الباقة', c.plan],
                      ['الرصيد', c.balance],
                      ['الحصة القادمة', c.next],
                    ].map(([k, v], i) => (
                      <div
                        key={k}
                        className={cn(
                          'flex items-center justify-between rounded-ctl px-3 py-2.5 text-sm',
                          i === 0 ? 'border border-brand/50 bg-brand/5' : 'bg-field',
                        )}
                      >
                        <span className="text-muted">{k}</span>
                        <span className="font-bold text-ink">{v}</span>
                      </div>
                    ))}
                    {c.code !== null && (
                      <div className="flex items-center justify-between rounded-ctl bg-field px-3 py-2.5 text-sm">
                        <span className="flex items-center gap-1.5 text-muted">
                          <KeyRound className="size-4 text-gold-text" aria-hidden />
                          رمز دخول الطالب
                        </span>
                        {c.code || issued[c.id] ? (
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              className="tabular font-bold tracking-[0.25em] text-ink"
                              onClick={() => setRevealed(revealed === c.id ? undefined : c.id)}
                              aria-label={revealed === c.id ? 'إخفاء الرمز' : 'إظهار الرمز'}
                              dir="ltr"
                            >
                              {revealed === c.id ? (issued[c.id] ?? c.code) : '••••••'}
                            </button>
                            <button
                              type="button"
                              aria-label="نسخ الرمز"
                              className="text-brand"
                              onClick={() => navigator.clipboard?.writeText(issued[c.id] ?? c.code ?? '')}
                            >
                              <Copy className="size-4" />
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="text-xs font-bold text-brand" onClick={() => issue(c.id)}>
                            إصدار رمز
                          </button>
                        )}
                      </div>
                    )}
                    {issued[c.id] && <p className="px-1 text-xs text-muted">احفظي الرمز الآن؛ لا يظهر مرة أخرى، وإصدار رمز جديد يُبطله.</p>}
                    {error && open === c.id && <p className="px-1 text-xs text-danger">{error}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {current && (
        <ButtonLink href={`/guardian?child=${current.id}`} block>
          انتقل إلى ملف {current.name}
        </ButtonLink>
      )}
    </div>
  );
}
