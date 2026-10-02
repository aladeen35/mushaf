'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { APPLICATION_STATUS, canMoveApplication, type ApplicationStatus } from '@/lib/domain/teachers';

const NEXT: ApplicationStatus[] = ['under_review', 'needs_info', 'interview', 'accepted', 'rejected'];

/** نقل طلب الانضمام لمرحلته التالية؛ القبول ينشئ حساب المعلمة ودورها */
export function ApplicationActions({ id, status }: { id: string; status: ApplicationStatus }) {
  const router = useRouter();
  const options = NEXT.filter((s) => canMoveApplication(status, s));
  const [target, setTarget] = useState<ApplicationStatus>();
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<ApplicationStatus>();
  if (!options.length) return null;
  if (moved) return <p className="text-[11px] font-bold text-success">نُقل إلى «{APPLICATION_STATUS[moved].label}»</p>;

  const needs = target === 'rejected' || target === 'needs_info' ? 'text' : target === 'interview' ? 'when' : null;
  const submit = async () => {
    if (!target) return;
    if (!IS_LIVE) return (setMoved(target), setTarget(undefined));
    setBusy(true);
    setError(undefined);
    try {
      await api(`/teacher-applications/${id}/status`, {
        method: 'PATCH',
        body: {
          status: target,
          ...(target === 'rejected' ? { rejectionReason: text } : {}),
          ...(target === 'needs_info' ? { missingInfo: text } : {}),
          ...(target === 'interview' ? { interviewAt: new Date(when).toISOString() } : {}),
        },
      });
      setMoved(target);
      setTarget(undefined);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 pt-1">
        {options.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTarget(s);
              setText('');
              setError(undefined);
              // نسخة العرض: الانتقال الذي لا يحتاج سبباً أو موعداً يُعرض فوراً
              if (!IS_LIVE && !['rejected', 'needs_info', 'interview'].includes(s)) setMoved(s);
            }}
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s === 'rejected' ? 'bg-danger/10 text-danger' : s === 'accepted' ? 'bg-brand text-on-brand' : 'bg-field text-brand'}`}
          >
            {APPLICATION_STATUS[s].label}
          </button>
        ))}
      </div>
      <Modal open={Boolean(target) && (IS_LIVE || Boolean(needs))} onClose={() => setTarget(undefined)} title={target ? `نقل إلى «${APPLICATION_STATUS[target].label}»` : ''}>
        <div className="space-y-4">
          {needs === 'text' && (
            <TextArea
              id={`why-${id}`}
              label={target === 'rejected' ? 'سبب الاعتذار (يصل للمتقدمة)' : 'المعلومات المطلوبة'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              minLength={3}
            />
          )}
          {needs === 'when' && <TextField id={`when-${id}`} label="موعد المقابلة" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}
          {target === 'accepted' && <p className="text-sm leading-6 text-muted">يُنشأ حساب المعلمة برقمها ودورها، وتُبلَّغ: «مبارك! قُبلتِ معلمةً في أكاديمية مآب. حبابك».</p>}
          {error && <p className="rounded-ctl bg-danger/8 px-3 py-2 text-sm text-danger">{error}</p>}
          <Button block disabled={busy || (needs === 'text' && text.trim().length < 3) || (needs === 'when' && !when)} onClick={submit}>
            تأكيد
          </Button>
        </div>
      </Modal>
    </>
  );
}
