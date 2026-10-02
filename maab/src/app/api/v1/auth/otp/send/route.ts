import { parsePhone } from '@/lib/phone';
import { badRequest } from '@/server/api/http';
import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { sendOtp } from '@/server/auth/otp';

// حدّ النقطة لكل عنوان IP، فوق حدّ الإرسال لكل رقم (3 كل 10 دقائق) في القاعدة
export const POST = route({ auth: 'public', limit: { max: 10, windowSec: 600 } }, async (ctx) => {
  const body = await ctx.json(S.otpSend);
  const meta = { ip: ctx.ip, userAgent: ctx.userAgent };
  if ('phone' in body) {
    const p = parsePhone(body.phone, body.country);
    if (!p) throw badRequest('phone_invalid', 'رقم الجوال غير صحيح، تأكدي من مفتاح الدولة');
    return { ...(await sendOtp({ kind: 'phone', value: p.e164, country: p.country }, body.channel, meta)), to: p.e164 };
  }
  const email = body.email.trim().toLowerCase();
  return { ...(await sendOtp({ kind: 'email', value: email }, 'email', meta)), to: email };
});
