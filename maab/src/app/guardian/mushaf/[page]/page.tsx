import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MushafReader } from '@/components/mushaf/MushafReader';
import { TOTAL_PAGES } from '@/lib/quran';

export async function generateMetadata({ params }: PageProps<'/guardian/mushaf/[page]'>): Promise<Metadata> {
  return { title: `المصحف · صفحة ${(await params).page}` };
}

export default async function ReaderPage({ params }: PageProps<'/guardian/mushaf/[page]'>) {
  const n = Number((await params).page);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) notFound();
  return <MushafReader base="/guardian/mushaf" page={n} />;
}
