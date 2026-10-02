import { eq } from 'drizzle-orm';
import { notFound } from '@/server/api/http';
import { route } from '@/server/api/route';
import { asUser } from '@/server/db/client';
import { files } from '@/server/db/schema';
import { signedUrl } from '@/server/services/files';

// الرابط يصدر بعد قراءة الملف بهوية المستخدم: سياسة RLS هي فحص الملكية والدور
export const GET = route<{ id: string }>({}, async ({ viewer, params }) => {
  const [file] = await asUser(viewer.userId, (tx) => tx.select().from(files).where(eq(files.id, params.id)));
  if (!file || file.deletedAt) throw notFound('الملف');
  return { ...(await signedUrl(file)), mime: file.mime };
});
