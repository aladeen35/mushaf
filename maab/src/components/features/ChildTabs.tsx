import Link from 'next/link';
import { cn } from '@/lib/cn';

/** التبديل بين ملفات الأبناء على الرأس الأخضر */
export function ChildTabs({
  items,
  active,
  base,
}: {
  items: { id: string; name: string }[];
  active: string;
  base: string;
}) {
  if (items.length < 2) return null;
  return (
    <nav aria-label="الأبناء" className="flex gap-2">
      {items.map((c) => (
        <Link
          key={c.id}
          href={`${base}?child=${c.id}`}
          aria-current={c.id === active ? 'true' : undefined}
          className={cn(
            'h-9 rounded-full px-4 text-sm leading-9 font-bold transition',
            c.id === active ? 'bg-card text-brand shadow-sm' : 'bg-white/10 text-on-hero/85 hover:bg-white/16',
          )}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}

export function pickChild<T extends { id: string }>(list: T[], id: string | string[] | undefined): T {
  return list.find((c) => c.id === id) ?? list[0];
}
