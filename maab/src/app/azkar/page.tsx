import type { Metadata } from 'next';
import { ParamPanels, ParamTabs } from '@/components/features/ParamPanels';
import { AppShell, Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import adhkar from '@/lib/content/adhkar.json';
import { AzkarList } from './AzkarList';

export const metadata: Metadata = { title: 'الأذكار' };

export default function Azkar() {
  return (
    <AppShell role="guardian">
      <WaveHeader title="الأذكار والورد" back="/guardian/account">
        <ParamPanels param="s" panels={Object.fromEntries(adhkar.map((x) => [x.key, <p key={x.key} className="pb-2 text-center text-sm text-on-hero/80">{x.hint}</p>]))} />
      </WaveHeader>
      <Page className="-mt-4">
        <ParamTabs param="s" label="الأقسام" tabs={adhkar.map((x) => ({ key: x.key, label: x.name, href: `/azkar?s=${x.key}` }))} />
        <ParamPanels param="s" panels={Object.fromEntries(adhkar.map((x) => [x.key, <AzkarList key={x.key} items={x.items} />]))} />
        <p className="text-center text-[11px] text-muted">محتوى ابتدائي تراجعه المشرفة الأكاديمية قبل الإطلاق.</p>
      </Page>
    </AppShell>
  );
}
