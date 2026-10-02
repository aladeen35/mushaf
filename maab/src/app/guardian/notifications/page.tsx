import { BellRing, CalendarSync, ClipboardCheck, Receipt, TriangleAlert, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { RescheduleRequest } from '@/components/features/RescheduleRequest';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { cn } from '@/lib/cn';
import { notifications } from '@/lib/demo/data';
import { now } from '@/lib/demo/queries';
import { fmtRelativeDay, fmtTime } from '@/lib/format';
import type { NotificationKind } from '@/lib/types';

export const metadata: Metadata = { title: 'الإشعارات' };

const KIND: Record<NotificationKind, { icon: typeof BellRing; bar: string; tint: string }> = {
  reminder: { icon: BellRing, bar: 'bg-gold', tint: 'bg-gold/14 text-gold-text' },
  report: { icon: ClipboardCheck, bar: 'bg-success', tint: 'bg-success/12 text-success' },
  payment: { icon: Receipt, bar: 'bg-brand', tint: 'bg-brand/10 text-brand' },
  balance: { icon: TriangleAlert, bar: 'bg-warning', tint: 'bg-warning/14 text-warning' },
  reschedule: { icon: CalendarSync, bar: 'bg-gold', tint: 'bg-gold/14 text-gold-text' },
  teacher: { icon: UserRound, bar: 'bg-brand', tint: 'bg-brand/10 text-brand' },
};

export default function Notifications() {
  const at = now();
  return (
    <>
      <WaveHeader title="الإشعارات" back="/guardian" />
      <Page className="-mt-4 space-y-0">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-bold text-ink">الأحدث</span>
          <button type="button" className="text-xs font-bold text-brand">
            تحديد الكل كمقروء
          </button>
        </div>
        <ul className="overflow-hidden rounded-card bg-card shadow-card">
          {notifications.map((n) => {
            const k = KIND[n.kind];
            const Icon = k.icon;
            const body = (
              <>
                <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', k.tint)} aria-hidden>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      {!n.read && <span className="size-2 rounded-full bg-gold" aria-label="غير مقروء" />}
                      {n.title}
                    </span>
                    <span className="tabular shrink-0 text-[11px] text-muted">
                      {fmtRelativeDay(new Date(n.at), at)} {fmtTime(new Date(n.at))}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted">{n.body}</span>
                </span>
              </>
            );
            return (
              <li key={n.id} className="relative border-b border-line last:border-0">
                <span aria-hidden className={cn('absolute inset-y-3 end-0 w-1 rounded-s-full', k.bar)} />
                {n.href ? (
                  <Link href={n.href} className="flex gap-3 py-4 ps-4 pe-5 hover:bg-field">
                    {body}
                  </Link>
                ) : (
                  <div className="py-4 ps-4 pe-5">
                    <div className="flex gap-3">{body}</div>
                    {n.actionable && (
                      <div className="mt-3 ps-15">
                        <RescheduleRequest compact />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Page>
    </>
  );
}
