'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// اختيار الابن بـ?child= يُقرأ في المتصفح: الصفحة نفسها ثابتة تحمل ملف كل
// ابن، فتعمل في النسخة الثابتة دون خادم، وفي النسخة الحية دون طلب جديد.

function useChild(ids: string[]): string {
  const id = useSearchParams().get('child');
  return id && ids.includes(id) ? id : ids[0];
}

type TabsProps = { items: { id: string; name: string }[]; base: string };

function Tabs(props: TabsProps) {
  return <TabsView {...props} active={useChild(props.items.map((c) => c.id))} />;
}

function TabsView({ items, base, active }: TabsProps & { active: string }) {
  return (
    <nav aria-label="الأبناء" className="flex gap-2">
      {items.map((c) => (
        <Link
          key={c.id}
          href={`${base}?child=${c.id}`}
          scroll={false}
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

/** التبديل بين ملفات الأبناء على الرأس الأخضر */
export function ChildTabs({ items, base }: { items: { id: string; name: string }[]; base: string }) {
  if (items.length < 2) return null;
  return (
    <Suspense fallback={<TabsView items={items} base={base} active={items[0].id} />}>
      <Tabs items={items} base={base} />
    </Suspense>
  );
}

function Selected({ panels, ids }: { panels: Record<string, ReactNode>; ids: string[] }) {
  return <>{panels[useChild(ids)]}</>;
}

/** محتوى الابن المختار؛ يُعرض الأول حتى تُقرأ الوصلة */
export function ChildPanels({ panels }: { panels: Record<string, ReactNode> }) {
  const ids = Object.keys(panels);
  return (
    <Suspense fallback={panels[ids[0]]}>
      <Selected panels={panels} ids={ids} />
    </Suspense>
  );
}
