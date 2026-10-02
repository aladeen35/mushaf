import { badRequest } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { fileFromForm } from '@/server/services/files';
import { listApplications, submitApplication, type ApplicationInput } from '@/server/services/teachers';

const DOCS = ['id_document', 'ijazah', 'certificate', 'recording'] as const;

// طلب الانضمام متاح دون حساب، بحدّ صارم لكل عنوان
export const POST = route({ auth: 'optional', limit: { max: 3, windowSec: 3600 } }, async (ctx) => {
  const form = await ctx.req.formData().catch(() => null);
  if (!form) throw badRequest('multipart_required', 'أرسلي الطلب مع المرفقات');
  const fields = S.application.parse({
    ...Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')),
    categories: form.getAll('categories'),
  });
  const documents: ApplicationInput['documents'] = [];
  for (const kind of DOCS) {
    const bytes = await fileFromForm(form, kind);
    if (bytes) documents.push({ kind, bytes });
  }
  return submitApplication(ctx.viewer, { ...fields, documents }, ctx.ip);
});

export const GET = route({ can: 'teachers.approve' }, async (ctx) => listApplications(ctx.viewer, ctx.query(S.applicationsQuery).status));
