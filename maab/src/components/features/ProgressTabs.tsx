import Link from 'next/link';
import { cn } from '@/lib/cn';

/** تبويبا «الإحصاءات» و«الخريطة» داخل قسم الحفظ */
export function ProgressTabs({ active, child }: { active: 'stats' | 'map'; child: string }) {
  const tabs = [
    { key: 'stats', label: 'الإحصاءات', href: `/guardian/progress?child=${child}` },
    { key: 'map', label: 'خريطة الحفظ', href: `/guardian/progress/map?child=${child}` },
  ] as const;
  return (
    <nav aria-label="أقسام الحفظ" className="grid grid-cols-2 gap-1 rounded-ctl bg-card p-1 shadow-card">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? 'page' : undefined}
          className={cn(
            'rounded-[10px] py-2.5 text-center text-sm font-bold transition',
            t.key === active ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
