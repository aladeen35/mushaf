import type { ReactNode } from 'react';

/** عمود الجوال بلا شريط سفلي — للدخول والتسجيل */
export function PlainShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:bg-sunken">
      <div className="relative mx-auto min-h-dvh max-w-md bg-page pb-10 md:shadow-[0_0_60px_-30px_rgb(var(--shadow-ink)/0.5)]">
        {children}
      </div>
    </div>
  );
}
