import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

/**
 * عمود الجوال: التصميم للجوال أولاً (القسم 16)، وعلى الشاشات الأعرض
 * يبقى العمود في الوسط بعرض الجوال ويتّسع ما حوله.
 */
export function AppShell({ role, children }: { role: 'guardian' | 'teacher'; children: ReactNode }) {
  return (
    <div className="min-h-dvh md:bg-sunken">
      <div className="relative mx-auto min-h-dvh max-w-md bg-page pb-28 md:shadow-[0_0_60px_-30px_rgb(var(--shadow-ink)/0.5)]">
        {children}
      </div>
      <BottomNav role={role} />
    </div>
  );
}

/** حاوية المحتوى تحت الرأس المنحني */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`relative z-10 space-y-6 px-4 ${className}`}>{children}</main>;
}
