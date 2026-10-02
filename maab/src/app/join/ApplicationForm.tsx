'use client';

import { CircleCheck, FileUp, Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPills } from '@/components/ui/Choice';
import { TextArea, TextField } from '@/components/ui/Field';
import { guessCountry, PhoneInput } from '@/components/ui/PhoneInput';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { CITIES } from '@/lib/cities';
import { cn } from '@/lib/cn';
import type { CountryCode } from '@/lib/domain/market';
import { parsePhone } from '@/lib/phone';
import { TEACHER_DOCUMENTS } from '@/lib/domain/teachers';

// الأنواع والأحجام المسموحة (القسم 15)
const DOC_TYPES = 'application/pdf,image/jpeg,image/png';
const AUDIO_TYPES = 'audio/mpeg,audio/mp4,audio/x-m4a';
/** حقل الملف في الخادم لكل مستند */
const FIELD: Record<string, string> = { national_id: 'id_document', ijazah: 'ijazah', degree: 'certificate', tajweed: 'certificate', recording: 'recording' };

export function ApplicationForm() {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [categories, setCategories] = useState<string[]>(['children']);
  const [missing, setMissing] = useState<string[]>([]);
  const [country, setCountry] = useState<CountryCode>('SD');
  const [f, setF] = useState({ name: '', phone: '', city: '', ijazah: '', experience: '', email: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    const t = setTimeout(() => setCountry(guessCountry()), 0);
    return () => clearTimeout(t);
  }, []);

  if (sent) {
    return (
      <Card className="space-y-3 p-6 text-center">
        <CircleCheck className="mx-auto size-14 text-success" strokeWidth={1.5} aria-hidden />
        <p className="text-lg font-bold text-ink">استلمنا طلبك</p>
        <p className="text-sm leading-6 text-muted">
          جزاكِ الله خيراً. الحالة الآن «طلب جديد»، تراجع المشرفة المستندات ثم تحجز معك مقابلة تسميع، ويصلك كل تحديث برسالة.
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
      onSubmit={async (e) => {
        e.preventDefault();
        const m = docs.filter((d) => d.required && !files[d.key]).map((d) => d.key);
        setMissing(m);
        if (m.length) return;
        const phone = parsePhone(f.phone, country);
        if (!phone) return setError('رقم الجوال غير صحيح، تأكدي من الدولة والرقم');
        if (!categories.length) return setError('اختاري فئة واحدة على الأقل');
        if (!IS_LIVE) return setSent(true);
        const form = new FormData();
        form.set('fullName', f.name.trim());
        form.set('phone', phone.e164);
        form.set('country', phone.country);
        if (f.email.trim()) form.set('email', f.email.trim());
        if (f.city.trim()) form.set('city', f.city.trim());
        form.set('ijazah', f.ijazah.trim());
        form.set('experience', f.experience.trim());
        for (const c of categories) form.append('categories', c);
        for (const [key, file] of Object.entries(files)) form.append(FIELD[key], file);
        setBusy(true);
        setError(undefined);
        try {
          await api('/teacher-applications', { form });
          setSent(true);
        } catch (err) {
          setError(errorText(err));
          setBusy(false);
        }
      }}
    >
      <Card className="space-y-4 p-4">
        <TextField id="t-name" label="الاسم الكامل" required autoComplete="name" value={f.name} onChange={set('name')} />
        <PhoneInput id="t-phone" label="رقم الجوال (واتساب)" country={country} onCountry={setCountry} value={f.phone} onValue={(v) => setF((x) => ({ ...x, phone: v }))} required />
        <TextField id="t-email" label="البريد الإلكتروني (اختياري)" type="email" dir="ltr" className="[&_input]:text-left" value={f.email} onChange={set('email')} />
        <TextField id="t-city" label="المدينة" list="t-cities" placeholder="مثل: الخرطوم، الرياض" value={f.city} onChange={set('city')} />
        <datalist id="t-cities">
          {CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <TextField id="t-ijazah" label="المُجيز والرواية" placeholder="مثال: الشيخة … — حفص عن عاصم" required value={f.ijazah} onChange={set('ijazah')} />
        <DayPills
          legend="الفئات التي تدرّسينها"
          value={categories}
          onChange={setCategories}
          options={[
            { value: 'children', label: 'الأطفال' },
            { value: 'women', label: 'النساء' },
          ]}
        />
        <TextArea id="t-exp" label="الخبرة السابقة" placeholder="مثال: 5 سنوات في خلوة … مع الأطفال" required value={f.experience} onChange={set('experience')} />
      </Card>

      <Card className="space-y-2.5 p-4">
        <p className="font-bold text-ink">المستندات</p>
        {docs.map((d) => {
          const isAudio = d.key === 'recording';
          const name = files[d.key]?.name;
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
                  const file = e.target.files?.[0];
                  if (file) {
                    setFiles((x) => ({ ...x, [d.key]: file }));
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

      {error && <p className="rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" block disabled={busy}>
        إرسال طلب الانضمام
      </Button>
    </form>
  );
}
