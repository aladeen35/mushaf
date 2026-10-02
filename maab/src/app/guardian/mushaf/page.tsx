import type { Metadata } from 'next';
import { MushafIndex } from '@/components/mushaf/MushafIndex';
import { childrenOf } from '@/lib/demo/queries';
import { pageOf } from '@/lib/quran/server';

export const metadata: Metadata = { title: 'المصحف' };

export default async function GuardianMushaf({ searchParams }: PageProps<'/guardian/mushaf'>) {
  const { tab } = await searchParams;
  const wird = pageOf(childrenOf()[0].current.from);
  return <MushafIndex base="/guardian/mushaf" tab={tab === 'juz' ? 'juz' : 'surahs'} wirdPage={wird} />;
}
