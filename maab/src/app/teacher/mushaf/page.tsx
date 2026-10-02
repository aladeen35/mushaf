import type { Metadata } from 'next';
import { MushafIndex } from '@/components/mushaf/MushafIndex';

export const metadata: Metadata = { title: 'المصحف' };

export default function TeacherMushaf() {
  return <MushafIndex base="/teacher/mushaf" wirdPage={1} />;
}
