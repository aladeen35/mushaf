'use client';

import { CalendarCog, LayoutDashboard, Receipt, ScrollText, Settings, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const ADMIN_NAV = [
  { href: '/admin', label: 'لوحة اليوم', icon: LayoutDashboard, exact: true },
  { href: '/admin/payments', label: 'التحويلات', icon: Receipt, badge: 6 },
  { href: '/admin/teachers', label: 'طلبات المعلمات', icon: UserCheck, badge: 3 },
  { href: '/admin#schedule', label: 'الجدولة', icon: CalendarCog },
  { href: '/admin#audit', label: 'سجل التدقيق', icon: ScrollText },
  { href: '/admin#settings', label: 'الإعدادات', icon: Settings },
];

export function AdminNav({ variant }: { variant: 'side' | 'top' }) {
  const pathname = usePathname();
  return (
    <nav aria-label="أقسام الإدارة" className={variant === 'top' ? '-mx-4 overflow-x-auto px-4 [scrollbar-width:none]' : ''}>
      <ul className={variant === 'top' ? 'flex gap-2' : 'space-y-1'}>
        {ADMIN_NAV.map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-ctl text-sm font-semibold whitespace-nowrap transition',
                  variant === 'side' ? 'h-11 px-3' : 'h-9 px-3.5',
                  active ? 'bg-white/12 text-on-hero ring-1 ring-gold/40' : 'text-on-hero/70 hover:bg-white/6 hover:text-on-hero',
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="flex-1">{label}</span>
                {badge ? <span className="tabular rounded-full bg-gold px-1.5 text-[11px] leading-5 font-bold text-brand-deep">{badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
