import { badRequest } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { submitReceipt } from '@/server/services/billing';
import { fileFromForm } from '@/server/services/files';

export const POST = route<{ ref: string }>({ idempotent: true }, async (ctx) => {
  const form = await ctx.req.formData().catch(() => null);
  if (!form) throw badRequest('multipart_required', 'أرفقي صورة الإيصال');
  const bytes = await fileFromForm(form, 'file');
  if (!bytes) throw badRequest('file_required', 'أرفقي صورة الإيصال');
  const fields = S.receipt.parse({ senderName: form.get('senderName'), transferDate: form.get('transferDate') });
  return submitReceipt(ctx.viewer, ctx.params.ref, { bytes, ...fields }, ctx.ip);
});
