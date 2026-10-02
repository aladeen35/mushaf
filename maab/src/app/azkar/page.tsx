import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell, Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { cn } from '@/lib/cn';
import adhkar from '@/lib/content/adhkar.json';
import { AzkarList } from './AzkarList';

export const metadata: Metadata = { title: 'الأذكار' };

export default async function Azkar({ searchParams }: PageProps<'/azkar'>) {
  const { s } = await searchParams;
  const section = adhkar.find((x) => x.key === s) ?? adhkar[0];
  return (
    <AppShell role="guardian">
      <WaveHeader title="الأذكار والورد" back="/guardian/account">
        <p className="pb-2 text-center text-sm text-on-hero/80">{section.hint}</p>
      </WaveHeader>
      <Page className="-mt-4">
        <nav aria-label="الأقسام" className="grid grid-cols-2 gap-1 rounded-ctl bg-card p-1 shadow-card">
          {adhkar.map((x) => (
            <Link
              key={x.key}
              href={`/azkar?s=${x.key}`}
              aria-current={x.key === section.key ? 'page' : undefined}
              className={cn(
                'rounded-[10px] py-2.5 text-center text-sm font-bold',
                x.key === section.key ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink',
              )}
            >
              {x.name}
            </Link>
          ))}
        </nav>
        <AzkarList key={section.key} items={section.items} />
        <p className="text-center text-[11px] text-muted">محتوى ابتدائي تراجعه المشرفة الأكاديمية قبل الإطلاق.</p>
      </Page>
    </AppShell>
  );
}
