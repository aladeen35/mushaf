import { BookOpenText, ChevronLeft, LogOut } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoHorizontal } from '@/components/brand/Brand';
import { NextSessionCard } from '@/components/features/NextSessionCard';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Lawh, LawhLine } from '@/components/sudan/Lawh';
import { SharafaCard } from '@/components/sudan/Sharafa';
import { Card, SectionTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { dataset } from '@/lib/data';
import { fmtFullDate, fmtHijri } from '@/lib/format';
import { SEGMENT_LABEL } from '@/lib/labels';
import { formatRange } from '@/lib/quran';
import { JUZ_NAMES, juzOrdinal } from '@/lib/quran/names';
import { pageOf } from '@/lib/quran/server';
import { LogoutButton } from './LogoutButton';

export const metadata: Metadata = { title: 'صفحتي' };

/**
 * صفحة الطالب القاصر: حصته القادمة، ولوح واجبه، وتقدّمه — بلا أي بيانات مالية
 * ولا إعدادات حساب. يدخلها برمز من ولي أمره.
 */
export default async function StudentHome() {
  const d = await dataset('guardian');
  const at = d.now();
  const me = d.childrenOf()[0];
  if (!me) {
    return (
      <PlainShell>
        <WaveHeader title="صفحتي" back="/" />
        <main className="px-5">
          <Card className="p-5 text-center text-sm text-muted">لم يُربط هذا الرمز بطالب بعد، اسأل ولي أمرك.</Card>
        </main>
      </PlainShell>
    );
  }
  const next = d.upcoming([me.id], at)[0];
  const last = d.reportsOf(me.id)[0];
  const juz = d.juzProgress(me);
  const current = juz.find((j) => j.status === 'in_progress') ?? juz.find((j) => j.status === 'not_started') ?? juz[29];
  const done = (me.plan.direction === 'nas_to_baqarah' ? [...juz].reverse() : juz).filter((j) => j.status === 'memorized');

  return (
    <PlainShell>
      <WaveHeader overlap start={<LogoHorizontal tone="hero" />} end={<LogoutButton />}>
        <div className="mt-3 space-y-1">
          <p className="text-2xl font-bold">حبابك يا {me.name}</p>
          <p className="text-sm text-on-hero/75">
            {fmtFullDate(at)} · {fmtHijri(at)}
          </p>
        </div>
      </WaveHeader>
      <main className="relative z-10 -mt-20 space-y-6 px-4">
        {next ? (
          <NextSessionCard
            sessionId={next.id}
            who={me.name}
            teacher={d.getTeacher(next.teacherId).name}
            startsAt={new Date(next.startsAt)}
            durationMin={next.durationMin}
            now={at}
          />
        ) : (
          <Card className="p-4 text-sm text-muted">لسه ما في حصة قادمة.</Card>
        )}

        {last?.homework.length ? (
          <section className="space-y-3">
            <SectionTitle>واجب لوحك</SectionTitle>
            <Lawh
              label="لوح اليوم"
              footer={
                <Link href={`/guardian/mushaf/${pageOf(last.homework[0].from)}`} className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <BookOpenText className="size-4" aria-hidden />
                    افتح الصفحة {pageOf(last.homework[0].from)} في المصحف
                  </span>
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
              }
            >
              {last.homework.map((h) => (
                <LawhLine key={`${h.type}-${h.from.surah}-${h.from.ayah}`} kind={SEGMENT_LABEL[h.type]}>
                  {formatRange(h.from, h.to)}
                </LawhLine>
              ))}
            </Lawh>
          </section>
        ) : null}

        {done.length > 0 && (
          <SharafaCard juz={`${juzOrdinal(done.at(-1)!.juz)} (${JUZ_NAMES[done.at(-1)!.juz - 1]})`} student={me.name} female={me.gender === 'female'} />
        )}

        <section className="space-y-3">
          <SectionTitle>أين وصلت</SectionTitle>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-ink">الجزء {current.juz}</p>
              <span className="tabular text-2xl font-bold text-brand">%{current.percent}</span>
            </div>
            <ProgressBar value={current.percent} label={`تقدّم الجزء ${current.juz}`} className="mt-3" />
            <p className="mt-3 text-xs text-muted">
              حفظت <b className="tabular text-ink">{d.memorizedTotal(me)}</b> آية · {done.length} جزء مكتمل
            </p>
          </Card>
        </section>
        <p className="flex items-center justify-center gap-1.5 pb-6 text-xs text-muted">
          <LogOut className="size-3.5" aria-hidden />
          اطلب من ولي أمرك رمزاً جديداً إن نسيت رمزك
        </p>
      </main>
    </PlainShell>
  );
}
