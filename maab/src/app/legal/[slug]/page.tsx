import { TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

// مسوّدات مبنية على قرارات المواصفات، وتحتاج مراجعة مستشار قبل الإطلاق (القسم 15)
const PAGES: Record<string, { title: string; points: string[] }> = {
  privacy: {
    title: 'سياسة الخصوصية',
    points: [
      'نجمع الاسم والجوال والمدينة والبريد (اختياري) لولي الأمر، والاسم وتاريخ الميلاد والمستوى للطالب، لغرض التعليم فقط.',
      'تسجيل القاصر يتطلب موافقة صريحة من ولي الأمر تُحفظ بالتاريخ والنسخة لكل سياسة.',
      'تُجمع أقل قدر من البيانات، ويحق لكِ تنزيل بياناتك أو طلب حذف حسابك في أي وقت.',
      'مستندات هوية المعلمات في تخزين خاص لا يراه إلا المشرفة والمدير العام، وتُحذف بيانات هوية المتقدّمات بعد 90 يومًا من رفض الطلب.',
      'كل وصول إلى بيانات حسّاسة وكل إجراء إداري يُسجَّل في سجل تدقيق غير قابل للتعديل.',
    ],
  },
  terms: {
    title: 'الشروط والأحكام',
    points: [
      'الأكاديمية لتحفيظ القرآن الكريم عن بُعد للأطفال والنساء، والتدريس بمعلمات فقط.',
      'الباقة رصيد حصص لطالب واحد صالح 30 يومًا من التفعيل، ولا تُفعَّل إلا بعد اعتماد التحويل.',
      'الباقة مرتبطة بالطالب لا بالمعلمة، وتغيير المعلمة يتم بطلب تراجعه المشرفة.',
    ],
  },
  refund: {
    title: 'سياسة الاسترداد',
    points: [
      'يُسجَّل الاسترداد حركةً عكسية مستقلة، ولا يُعدَّل الطلب الأصلي.',
      'الحصص المرحَّلة تنتهي بانتهاء الباقة التالية ولا تُرحَّل مرة ثانية.',
    ],
  },
  cancellation: {
    title: 'سياسة إلغاء الحصص والغياب',
    points: [
      'الإلغاء قبل الحصة بـ12 ساعة أو أكثر يعيد الرصيد، وتختارين موعدًا بديلًا ضمن صلاحية الباقة.',
      'الإلغاء قبل أقل من 12 ساعة أو الغياب دون إشعار يخصم الحصة ويُسجَّل «غياب الطالب».',
      'غياب الطالب بعذر تقبله الإدارة يعيد الرصيد باستثناء يدوي مع السبب.',
      'غياب المعلمة أو تأخّرها أكثر من 10 دقائق لا يخصم، وتُعقد حصة تعويضية إلزامية.',
      'الانقطاع التقني الموثّق لا يخصم، والتعويض بقرار الدعم.',
      'يعيد ولي الأمر الجدولة بنفسه حتى مرتين في الشهر ضمن مهلة 12 ساعة.',
    ],
  },
  recording: {
    title: 'سياسة عدم تسجيل الحصص',
    points: [
      'الحصص لا تُسجَّل صوتًا ولا صورة، حفاظًا على خصوصية الطالبات والأطفال.',
      'الكاميرا اختيارية للطالبة، والمعلمة تُعرض لها صورة الطالبة باسمها الأول فقط في الواجهات العامة.',
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<'/legal/[slug]'>): Promise<Metadata> {
  return { title: PAGES[(await params).slug]?.title };
}

export default async function Legal({ params }: PageProps<'/legal/[slug]'>) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  return (
    <PlainShell>
      <WaveHeader title={page.title} back="/" />
      <main className="space-y-4 px-5">
        <p className="flex items-start gap-2 rounded-ctl border border-warning/30 bg-warning/8 p-3 text-xs leading-5 text-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          مسوّدة مبنية على المواصفات، وتُراجَع من مستشار قانوني قبل الإطلاق وفق نظام حماية البيانات الشخصية.
        </p>
        <Card className="p-5">
          <ol className="space-y-3">
            {page.points.map((p, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-7 text-ink">
                <span className="tabular mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-brand/8 text-xs font-bold text-brand">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </Card>
        <nav aria-label="السياسات" className="flex flex-wrap gap-2">
          {Object.entries(PAGES).map(([k, v]) => (
            <Link
              key={k}
              href={`/legal/${k}`}
              aria-current={k === slug ? 'page' : undefined}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', k === slug ? 'border-brand bg-brand text-on-brand' : 'border-line text-muted hover:text-ink')}
            >
              {v.title}
            </Link>
          ))}
        </nav>
      </main>
    </PlainShell>
  );
}
