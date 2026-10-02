'use client';

import { CircleCheck, FileUp, Mic } from 'lucide-react';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPills } from '@/components/ui/Choice';
import { PhoneField, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { CITIES } from '@/lib/cities';
import { cn } from '@/lib/cn';
import { TEACHER_DOCUMENTS } from '@/lib/domain/teachers';

// الأنواع والأحجام المسموحة (القسم 15)
const DOC_TYPES = 'application/pdf,image/jpeg,image/png';
const AUDIO_TYPES = 'audio/mpeg,audio/mp4,audio/x-m4a';

export function ApplicationForm() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>(['children']);
  const [missing, setMissing] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <CircleCheck className="mx-auto size-14 text-success" strokeWidth={1.5} aria-hidden />
        <p className="text-lg font-bold text-ink">استلمنا طلبك</p>
        <p className="text-sm leading-6 text-muted">
          الحالة الآن «طلب جديد». تراجع المشرفة المستندات ثم تحجز معك مقابلة تسميع، ويصلك كل تحديث برسالة.
        </p>
        <ButtonLink href="/" variant="secondary" block>
          العودة للرئيسية
        </ButtonLink>
      </Card>
    );
  }

  const docs = TEACHER_DOCUMENTS.filter((d) => d.key !== 'experience');

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const m = docs.filter((d) => d.required && !files[d.key]).map((d) => d.key);
        setMissing(m);
        if (!m.length) setSent(true);
      }}
    >
      <Card className="space-y-4 p-4">
        <TextField id="t-name" label="الاسم الكامل" required autoComplete="name" />
        <PhoneField id="t-phone" label="رقم الجوال" placeholder="5X XXX XXXX" required />
        <SelectField id="t-city" label="المدينة" defaultValue="الرياض">
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <TextField id="t-ijazah" label="المُجيز والرواية" placeholder="مثال: الشيخة … — حفص عن عاصم" required />
        <DayPills
          legend="الفئات التي تدرّسينها"
          value={categories}
          onChange={setCategories}
          options={[
            { value: 'children', label: 'الأطفال' },
            { value: 'women', label: 'النساء' },
          ]}
        />
        <TextArea id="t-exp" label="الخبرة السابقة" placeholder="الجهات والسنوات والفئات العمرية" required />
      </Card>

      <Card className="space-y-2.5 p-4">
        <p className="font-bold text-ink">المستندات</p>
        {docs.map((d) => {
          const isAudio = d.key === 'recording';
          const name = files[d.key];
          return (
            <label
              key={d.key}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-ctl border border-dashed p-3 transition hover:bg-field',
                missing.includes(d.key) ? 'border-danger/60 bg-danger/5' : name ? 'border-success/50 bg-success/5' : 'border-line',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-ctl', name ? 'bg-success/12 text-success' : 'bg-gold/14 text-gold-text')} aria-hidden>
                {isAudio ? <Mic className="size-5" /> : <FileUp className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">
                  {d.label} {d.required && <span className="text-danger">*</span>}
                </span>
                <span className="block truncate text-xs text-muted">{name ?? d.note ?? (isAudio ? 'MP3 أو M4A حتى 10 ميجابايت' : 'PDF أو صورة حتى 5 ميجابايت')}</span>
              </span>
              <input
                type="file"
                className="sr-only"
                accept={isAudio ? AUDIO_TYPES : DOC_TYPES}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFiles((x) => ({ ...x, [d.key]: f.name }));
                    setMissing((m) => m.filter((k) => k !== d.key));
                  }
                }}
              />
            </label>
          );
        })}
        {missing.length > 0 && <p className="text-xs font-semibold text-danger">أرفقي المستندات الإلزامية المعلَّمة.</p>}
        <p className="text-[11px] leading-5 text-muted">الهوية والإجازة في تخزين خاص لا يراه إلا المشرفة والمدير العام.</p>
      </Card>

      <Button type="submit" block>
        إرسال طلب الانضمام
      </Button>
    </form>
  );
}
