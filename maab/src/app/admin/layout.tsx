import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { LogoHorizontal } from '@/components/brand/Brand';
import { AdminNav } from './AdminNav';

export const metadata: Metadata = { title: { default: 'الإدارة', template: '%s · إدارة مآب' } };

/** لوحات الإدارة تتّسع على الحاسوب بشريط جانبي أخضر داكن (القسم 16) */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 bg-brand-deep p-5 text-on-hero lg:flex">
        <div aria-hidden className="maab-pattern pointer-events-none absolute inset-0" />
        <div className="relative">
          <LogoHorizontal tone="hero" />
        </div>
        <div className="relative flex-1">
          <AdminNav variant="side" />
        </div>
        <div className="relative rounded-ctl bg-white/6 p-3 text-xs">
          <p className="font-bold">منيرة العتيبي</p>
          <p className="text-on-hero/70">المشرفة الأكاديمية</p>
          <p className="mt-2 flex items-center gap-1 text-gold">
            <ShieldCheck className="size-3.5" aria-hidden />
            المصادقة الثنائية مفعّلة
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="maab-hero relative isolate space-y-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
          <div aria-hidden className="maab-pattern absolute inset-0 -z-10" />
          <LogoHorizontal tone="hero" />
          <AdminNav variant="top" />
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
