'use client';

import { CircleCheck, Minus, Plus, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Choice';
import { Badge } from '@/components/ui/Chip';
import { TextArea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { cn } from '@/lib/cn';
import { fmtAyahs } from '@/lib/format';
import { GRADES, mastery, MEMORIZED_THRESHOLD, NO_MISTAKES, suggestGrade, type Grade, type Mistakes } from '@/lib/domain/mastery';
import { countAyahs, formatRange, isValidRef, SURAHS, type AyahRef } from '@/lib/quran';
import { ATTENDANCE_LABEL, SEGMENT_LABEL } from '@/lib/labels';
import type { Attendance, SegmentType } from '@/lib/types';

type Draft = { key: number; type: SegmentType; from: AyahRef; to: AyahRef; mistakes: Mistakes };

const TYPES: SegmentType[] = ['new', 'near_review', 'far_review', 'recitation', 'test'];
const MISTAKES: { key: keyof Mistakes; label: string }[] = [
  { key: 'hifz', label: 'حفظ' },
  { key: 'tajweed', label: 'تجويد' },
  { key: 'tashkeel', label: 'تشكيل' },
  { key: 'hesitation', label: 'تردد' },
];

function RefPicker({ id, label, value, onChange }: { id: string; label: string; value: AyahRef; onChange: (r: AyahRef) => void }) {
  const max = SURAHS[value.surah - 1].ayahs;
  return (
    <fieldset className="min-w-0 flex-1">
      <legend className="mb-1 text-xs font-semibold text-muted">{label}</legend>
      <div className="flex gap-1.5">
        <label htmlFor={`${id}-s`} className="sr-only">
          السورة
        </label>
        <select
          id={`${id}-s`}
          value={value.surah}
          onChange={(e) => onChange({ surah: Number(e.target.value), ayah: 1 })}
          className="h-10 min-w-0 flex-1 appearance-none rounded-ctl bg-field px-2 text-sm font-semibold text-ink outline-none focus:ring-1 focus:ring-gold"
        >
          {SURAHS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.name}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-a`} className="sr-only">
          الآية
        </label>
        <input
          id={`${id}-a`}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value.ayah}
          onChange={(e) => onChange({ ...value, ayah: Number(e.target.value) })}
          className="tabular h-10 w-16 rounded-ctl bg-field text-center text-sm font-bold text-ink outline-none focus:ring-1 focus:ring-gold"
        />
      </div>
    </fieldset>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-ctl bg-field p-1.5 text-center">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label={`زيادة أخطاء ${label}`}
          onClick={() => onChange(value + 1)}
          className="grid size-7 place-items-center rounded-lg bg-card text-danger shadow-sm"
        >
          <Plus className="size-3.5" strokeWidth={3} />
        </button>
        <span className={cn('tabular text-lg font-bold', value ? 'text-danger' : 'text-ink')} aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`إنقاص أخطاء ${label}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="grid size-7 place-items-center rounded-lg bg-card text-muted shadow-sm"
        >
          <Minus className="size-3.5" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

export function ReportForm({ student, initial, backHref }: { student: string; initial: Omit<Draft, 'key'>[]; backHref: string }) {
  const [attendance, setAttendance] = useState<Attendance>('present');
  const [segments, setSegments] = useState<Draft[]>(initial.map((s, i) => ({ ...s, key: i })));
  const [gradeTouched, setGradeTouched] = useState<Grade>();
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const held = attendance === 'present' || attendance === 'late';

  const computed = useMemo(
    () =>
      segments.map((s) => {
        const valid = isValidRef(s.from) && isValidRef(s.to);
        let ayahs = 0;
        let error: string | undefined;
        if (!valid) error = 'رقم آية خارج السورة';
        else {
          try {
            ayahs = countAyahs(s.from, s.to);
          } catch {
            error = 'نهاية المقطع قبل بدايته';
          }
        }
        return { ...s, ayahs, error, pct: mastery(s.mistakes) };
      }),
    [segments],
  );

  const totalAyahs = computed.reduce((n, s) => n + s.ayahs, 0);
  const avg = totalAyahs ? computed.reduce((n, s) => n + s.pct * s.ayahs, 0) / totalAyahs : 0;
  const suggested = suggestGrade(avg);
  const grade = gradeTouched ?? suggested;
  const hasErrors = computed.some((s) => s.error);
  const firstNew = computed.find((s) => s.type === 'new' && !s.error);

  const update = (key: number, patch: Partial<Draft>) => setSegments((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  if (sent) {
    return (
      <Card className="space-y-4 p-6 text-center">
        <CircleCheck className="mx-auto size-14 text-success" strokeWidth={1.5} aria-hidden />
        <p className="text-lg font-bold text-ink">أُرسل التقرير لولي الأمر</p>
        <p className="text-sm leading-6 text-muted">
          {held ? `${student}: ${fmtAyahs(totalAyahs, true)}، إتقان %${Math.round(avg)}، والواجب جاهز للحصة القادمة.` : `سُجّل «${ATTENDANCE_LABEL[attendance]}» للحصة.`}
        </p>
        <ButtonLink href={backHref} block>
          العودة لحصص اليوم
        </ButtonLink>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (held && (hasErrors || !segments.length)) return;
        setSent(true);
      }}
    >
      <Card className="space-y-2 p-4">
        <p className="text-sm font-bold text-ink">الحضور</p>
        <Segmented
          name="attendance"
          legend="الحضور"
          value={attendance}
          onChange={setAttendance}
          options={(Object.keys(ATTENDANCE_LABEL) as Attendance[]).map((a) => ({ value: a, label: ATTENDANCE_LABEL[a] }))}
        />
        {attendance === 'teacher_absent' && (
          <p className="text-xs leading-5 text-warning">لا يُخصم من رصيد الطالب، وتُنشأ حصة تعويضية إلزامية.</p>
        )}
        {attendance === 'absent' && <p className="text-xs leading-5 text-muted">تُخصم الحصة ويُبلَّغ ولي الأمر فورًا.</p>}
      </Card>

      {held && (
        <>
          {computed.map((s, i) => (
            <Card key={s.key} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink">
                  <span className="tabular">{i + 1}-</span> {SEGMENT_LABEL[s.type]}
                  {!s.error && <span className="ms-1 font-semibold text-muted">· {formatRange(s.from, s.to)}</span>}
                </p>
                {segments.length > 1 && (
                  <button
                    type="button"
                    aria-label="حذف المقطع"
                    onClick={() => setSegments((all) => all.filter((x) => x.key !== s.key))}
                    className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger/8 hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <Segmented
                name={`type-${s.key}`}
                legend="نوع المقطع"
                value={s.type}
                onChange={(type) => update(s.key, { type })}
                options={TYPES.map((t) => ({ value: t, label: SEGMENT_LABEL[t] }))}
              />
              <div className="flex gap-2">
                <RefPicker id={`from-${s.key}`} label="من" value={s.from} onChange={(from) => update(s.key, { from })} />
                <RefPicker id={`to-${s.key}`} label="إلى" value={s.to} onChange={(to) => update(s.key, { to })} />
              </div>
              {s.error && <p className="text-xs font-semibold text-danger">{s.error}</p>}
              <div className="grid grid-cols-4 gap-1.5">
                {MISTAKES.map((m) => (
                  <Stepper
                    key={m.key}
                    label={m.label}
                    value={s.mistakes[m.key]}
                    onChange={(v) => update(s.key, { mistakes: { ...s.mistakes, [m.key]: v } })}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <ProgressBar value={s.pct} label={`إتقان المقطع ${i + 1}`} />
                <span className="tabular shrink-0 text-sm font-bold text-ink">%{s.pct}</span>
                <Badge tone={s.pct >= MEMORIZED_THRESHOLD ? 'success' : 'danger'}>
                  {s.pct >= MEMORIZED_THRESHOLD ? 'محتسب' : 'يعود في الواجب'}
                </Badge>
              </div>
            </Card>
          ))}

          <Button
            variant="secondary"
            block
            onClick={() => {
              const last = segments.at(-1);
              const start = last ? last.from : { surah: 1, ayah: 1 };
              setSegments((all) => [...all, { key: Date.now(), type: 'near_review', from: start, to: start, mistakes: NO_MISTAKES }]);
            }}
          >
            <Plus className="size-5" aria-hidden />
            إضافة مقطع
          </Button>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-ink">التقدير</p>
              <span className="tabular text-xs text-muted">
                متوسط الإتقان %{Math.round(avg)} · مقترح: {GRADES.find((g) => g.value === suggested)!.label}
              </span>
            </div>
            <Segmented name="grade" legend="التقدير" value={grade} onChange={setGradeTouched} options={GRADES} />
          </Card>

          <Card className="space-y-4 p-4">
            <TextArea
              id="note"
              label="ملاحظة لولي الأمر"
              placeholder="نص قصير يظهر في التقرير"
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              hint={`${note.length}/280`}
            />
            <TextArea id="internal" label="ملاحظة داخلية" placeholder="للمشرفة فقط، لا يراها ولي الأمر" rows={2} />
            {firstNew && (
              <div className="rounded-ctl bg-field p-3 text-sm">
                <p className="font-bold text-ink">الواجب المقترح للحصة القادمة</p>
                <p className="mt-1 text-muted">
                  {firstNew.pct >= MEMORIZED_THRESHOLD
                    ? `حفظ ما بعد ${formatRange(firstNew.to, firstNew.to)}، ومراجعة ${formatRange(firstNew.from, firstNew.to)}`
                    : `إعادة حفظ ${formatRange(firstNew.from, firstNew.to)} — المقطع تحت %${MEMORIZED_THRESHOLD}`}
                </p>
              </div>
            )}
          </Card>
        </>
      )}

      <Button type="submit" block disabled={held && hasErrors}>
        <Send className="size-5" aria-hidden />
        إرسال التقرير
      </Button>
    </form>
  );
}
