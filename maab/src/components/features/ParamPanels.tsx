'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// تبويبات بقيمة في الرابط (?tab=juz) تُقرأ في المتصفح، فتبقى الصفحة ثابتة
// تعمل في النسخة الثابتة كما في الحية.

function useParam(param: string, keys: string[]) {
  const v = useSearchParams().get(param);
  return v && keys.includes(v) ? v : keys[0];
}

function Selected({ param, panels }: { param: string; panels: Record<string, ReactNode> }) {
  return <>{panels[useParam(param, Object.keys(panels))]}</>;
}

export function ParamPanels({ param, panels }: { param: string; panels: Record<string, ReactNode> }) {
  return (
    <Suspense fallback={panels[Object.keys(panels)[0]]}>
      <Selected param={param} panels={panels} />
    </Suspense>
  );
}

type Tab = { key: string; label: string; href: string };

function NavView({ tabs, active, label }: { tabs: Tab[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-1 rounded-ctl bg-card p-1 shadow-card">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={active === t.key ? 'page' : undefined}
          className={cn('rounded-[10px] py-2.5 text-center text-sm font-bold', active === t.key ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function Nav({ param, tabs, label }: { param: string; tabs: Tab[]; label: string }) {
  return <NavView tabs={tabs} label={label} active={useParam(param, tabs.map((t) => t.key))} />;
}

export function ParamTabs({ param, tabs, label }: { param: string; tabs: Tab[]; label: string }) {
  return (
    <Suspense fallback={<NavView tabs={tabs} label={label} active={tabs[0].key} />}>
      <Nav param={param} tabs={tabs} label={label} />
    </Suspense>
  );
}
