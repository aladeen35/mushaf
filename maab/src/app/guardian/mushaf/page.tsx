import type { Metadata } from 'next';
import { MushafIndex } from '@/components/mushaf/MushafIndex';
import { dataset } from '@/lib/data';
import { pageOf } from '@/lib/quran/server';

export const metadata: Metadata = { title: 'المصحف' };

export default async function GuardianMushaf() {
  const d = await dataset('guardian');
  const first = d.childrenOf()[0];
  return <MushafIndex base="/guardian/mushaf" wirdPage={first ? pageOf(first.current.from) : 1} />;
}
