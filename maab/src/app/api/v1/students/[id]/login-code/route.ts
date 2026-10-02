import { route } from '@/server/api/route';
import { issueStudentCode } from '@/server/services/students';

// الرمز يُعرض لولي الأمر مرة واحدة؛ إصدار رمز جديد يُبطل القديم
export const POST = route<{ id: string }>({ can: 'students.manage', limit: { max: 10, windowSec: 3600 } }, async (ctx) =>
  issueStudentCode(ctx.viewer, ctx.params.id, ctx.ip),
);
