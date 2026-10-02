'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * نافذة فوق خلفية ضبابية — كنافذة «إعادة تعيين كلمة المرور» في المرجع.
 * مبنية على <dialog> الأصلي فتحبس التركيز وتُغلق بزر Esc دون مكتبة.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-sm rounded-card bg-card p-0 text-ink shadow-lift open:animate-[modal-in_.18s_ease-out]',
        className,
      )}
    >
      <div className="relative px-5 pt-5 pb-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute end-4 top-4 grid size-7 place-items-center rounded-lg border border-line text-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
        <h2 id="modal-title" className="px-8 pt-1 text-center text-lg font-bold">
          {title}
        </h2>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
