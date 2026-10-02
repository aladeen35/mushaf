'use client';

import { CalendarDays, House, Sprout, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MushafIcon } from '@/components/brand/MushafIcon';
import { cn } from '@/lib/cn';

type Item = { href: string; label: string; icon: LucideIcon | typeof MushafIcon; exact?: boolean };

// ترتيب الشريط من اليمين: خمسة أقسام والرئيسية في الوسط كما في المرجع.
const NAV: Record<'guardian' | 'teacher', Item[]> = {
  guardian: [
    { href: '/guardian/progress', label: 'الحفظ', icon: Sprout },
    { href: '/guardian/schedule', label: 'الجدول', icon: CalendarDays },
    { href: '/guardian', label: 'الرئيسية', icon: House, exact: true },
    { href: '/guardian/mushaf', label: 'المصحف', icon: MushafIcon },
    { href: '/guardian/account', label: 'الحساب', icon: UserRound },
  ],
  teacher: [
    { href: '/teacher/students', label: 'طلابي', icon: UsersRound },
    { href: '/teacher/availability', label: 'أوقاتي', icon: CalendarDays },
    { href: '/teacher', label: 'الرئيسية', icon: House, exact: true },
    { href: '/teacher/mushaf', label: 'المصحف', icon: MushafIcon },
    { href: '/teacher/account', label: 'الحساب', icon: UserRound },
  ],
};

export function BottomNav({ role }: { role: 'guardian' | 'teacher' }) {
  const pathname = usePathname();
  return (
    <nav aria-label="التنقل الرئيسي" className="fixed inset-x-0 bottom-0 z-40 print:hidden">
      <div className="safe-bottom mx-auto max-w-md rounded-t-[22px] border-t border-line/70 bg-card shadow-[0_-12px_30px_-20px_rgb(var(--shadow-ink)/0.45)]">
        <ul className="grid grid-cols-5 px-1">
          {NAV[role].map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex h-16 flex-col items-center justify-end gap-1 pb-2.5 text-[11px]"
                >
                  {active ? (
                    <span className="absolute -top-5 grid size-14 place-items-center rounded-full bg-card shadow-[0_-8px_16px_-10px_rgb(var(--shadow-ink)/0.5)]">
                      <span className="grid size-11 place-items-center rounded-full bg-brand text-on-brand ring-2 ring-gold/70 ring-offset-2 ring-offset-card">
                        <Icon className="size-5" />
                      </span>
                    </span>
                  ) : (
                    <Icon className="mb-auto mt-3 size-[22px] text-muted" strokeWidth={1.8} />
                  )}
                  <span className={cn(active ? 'font-bold text-brand' : 'font-medium text-muted')}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
