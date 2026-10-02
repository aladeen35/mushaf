import type { Metadata } from 'next';
import { MushafIndex } from '@/components/mushaf/MushafIndex';

export const metadata: Metadata = { title: 'المصحف' };

export default async function TeacherMushaf({ searchParams }: PageProps<'/teacher/mushaf'>) {
  const { tab } = await searchParams;
  return <MushafIndex base="/teacher/mushaf" tab={tab === 'juz' ? 'juz' : 'surahs'} wirdPage={1} />;
}
