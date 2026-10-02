import { eq } from 'drizzle-orm';
import { ApiError, notFound } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { asSystem } from '@/server/db/client';
import { files } from '@/server/db/schema';
import { readObject, verifySignature } from '@/server/services/files';

// للتخزين المحلي: الرابط الموقّع نفسه هو الإذن، صالح 5 دقائق
export const GET = route<{ id: string }>({ auth: 'public' }, async (ctx) => {
  const { exp, sig } = ctx.query(S.fileContent);
  if (!verifySignature(ctx.params.id, exp, sig)) throw new ApiError(403, 'link_expired', 'انتهت صلاحية الرابط');
  const [file] = await asSystem(null, (tx) => tx.select().from(files).where(eq(files.id, ctx.params.id)));
  if (!file || file.deletedAt) throw notFound('الملف');
  const bytes = await readObject(file);
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
});
