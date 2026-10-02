import { badRequest } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { sessionCookie, signSession } from '@/server/auth/session';
import { homeFor } from '@/server/auth/users';
import { studentByCode } from '@/server/services/students';

// خمس محاولات كل ربع ساعة لكل عنوان: الرمز ستة أحرف من 31 حرفاً
export const POST = route({ auth: 'public', limit: { max: 5, windowSec: 900 } }, async (ctx) => {
  const { code } = await ctx.json(S.studentCode);
  const found = await studentByCode(code);
  if (!found) throw badRequest('code_invalid', 'الرمز غير صحيح، اطلبه من ولي أمرك');
  const { token, maxAge } = await signSession({ userId: found.userId, roles: found.roles });
  ctx.headers.append('Set-Cookie', sessionCookie(token, maxAge));
  return { next: homeFor(found.roles) };
});
