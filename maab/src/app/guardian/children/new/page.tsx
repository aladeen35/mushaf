import { Camera, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { Page } from '@/components/shell/AppShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { dayKey } from '@/lib/format';
import { dataset } from '@/lib/data';
import { AddChildForm } from './AddChildForm';

export const metadata: Metadata = { title: 'إضافة طالب' };

export default async function NewChild() {
  const d = await dataset('guardian');
  return (
    <>
      <WaveHeader title="إضافة طالب" back="/guardian/children" className="pb-20" />
      <Page className="-mt-16">
        <div className="flex justify-center">
          <span className="relative grid size-24 place-items-center rounded-full border-4 border-page bg-card text-brand shadow-lift">
            <UserRound className="size-11" strokeWidth={1.4} aria-hidden />
            <span className="absolute -bottom-1 end-0 grid size-8 place-items-center rounded-full border-2 border-card bg-brand text-on-brand" aria-hidden>
              <Camera className="size-4" />
            </span>
          </span>
        </div>
        <p className="-mt-2 text-center text-xs text-muted">الصورة اختيارية ولا تظهر إلا لكِ وللمعلمة.</p>
        <Card className="p-5">
          <AddChildForm today={dayKey(d.now())} />
        </Card>
      </Page>
    </>
  );
}
