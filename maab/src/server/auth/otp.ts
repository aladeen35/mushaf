// رمز الدخول (القسم 15): ستة أرقام، صالح 5 دقائق، 5 محاولات ثم قفل 15 دقيقة،
// وثلاثة طلبات إرسال لكل معرّف كل 10 دقائق. الرمز لا يُخزَّن، بل بصمته فقط.
//
// كل معاملة تُرجع نتيجتها ولا ترمي خطأً من داخلها، لأن الرمي يتراجع عن
// المعاملة فيضيع عدّاد المحاولات الفاشلة. والإرسال نفسه خارج المعاملة كي
// لا يبقى قفل الصف مفتوحاً أثناء انتظار مزوّد واتساب أو الرسائل.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { otpChannels, type CountryCode, type OtpChannel } from '@/lib/domain/market';
import { asSystem, type Tx } from '../db/client';
import { loginAttempts, otpChallenges } from '../db/schema';
import { ApiError, badRequest, tooMany } from '../api/http';
import { env } from '../env';
import { ChannelError, deliverOtp } from './channels';

export const OTP_TTL_MIN = 5;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MIN = 15;
export const OTP_SENDS_PER_WINDOW = 3;
export const OTP_WINDOW_MIN = 10;
export const OTP_RESEND_SEC = 60;

export type Identifier = { kind: 'phone'; value: string; country: CountryCode } | { kind: 'email'; value: string };

type Meta = { ip?: string | null; userAgent?: string | null };

const hash = (identifier: string, code: string) => createHmac('sha256', env().AUTH_SECRET).update(`${identifier}:${code}`).digest('hex');
const secondsUntil = (d: Date, now: Date) => Math.max(1, Math.ceil((d.getTime() - now.getTime()) / 1000));

export function channelsFor(id: Identifier): OtpChannel[] {
  return id.kind === 'email' ? ['email'] : otpChannels(id.country);
}

/** يُسلسل الطلبات المتزامنة للمعرّف نفسه فلا يتجاوز أحدٌ الحدّ بطلبات متوازية */
const serialize = (tx: Tx, identifier: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'otp:' + identifier}))`);

const log = (tx: Tx, identifier: string, channel: string, success: boolean, reason: string, meta: Meta) =>
  tx.insert(loginAttempts).values({ identifier, channel, success, reason, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null });

export type SendResult = { channel: OtpChannel; fallbacks: OtpChannel[]; resendInSec: number; expiresInSec: number };

export async function sendOtp(id: Identifier, requested: OtpChannel | undefined, meta: Meta = {}): Promise<SendResult> {
  const allowed = channelsFor(id);
  const channel = requested ?? allowed[0];
  if (!allowed.includes(channel)) throw badRequest('channel_not_allowed', 'هذه القناة غير متاحة لهذا الرقم', { allowed });
  // البريد بديل للرقم بإدخال البريد نفسه معرّفاً، لا بإرسال رمز الرقم إليه
  if (id.kind === 'phone' && channel === 'email') throw badRequest('use_email', 'أدخلي بريدك الإلكتروني لاستلام الرمز عليه');
  const fallbacks = allowed.filter((c) => c !== channel);
  const now = new Date();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  const claim = await asSystem(null, async (tx): Promise<ApiError | { challengeId: string }> => {
    await serialize(tx, id.value);
    const [locked] = await tx
      .select({ until: otpChallenges.lockedUntil })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.identifier, id.value), gt(otpChallenges.lockedUntil, now)))
      .orderBy(desc(otpChallenges.lockedUntil))
      .limit(1);
    if (locked?.until) return tooMany('تجاوزتِ عدد المحاولات، حاولي بعد قليل', secondsUntil(locked.until, now));

    const recent = await tx
      .select({ createdAt: otpChallenges.createdAt })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.identifier, id.value), gt(otpChallenges.createdAt, new Date(now.getTime() - OTP_WINDOW_MIN * 60_000))))
      .orderBy(desc(otpChallenges.createdAt));
    if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < OTP_RESEND_SEC * 1000) {
      return tooMany('انتظري قليلاً قبل طلب رمز جديد', secondsUntil(new Date(recent[0].createdAt.getTime() + OTP_RESEND_SEC * 1000), now));
    }
    if (recent.length >= OTP_SENDS_PER_WINDOW) {
      const oldest = recent[recent.length - 1].createdAt;
      return tooMany('طلبتِ رموزاً كثيرة، حاولي بعد قليل', secondsUntil(new Date(oldest.getTime() + OTP_WINDOW_MIN * 60_000), now));
    }

    // رمز واحد صالح في كل وقت: طلب رمز جديد يُبطل ما قبله
    await tx
      .update(otpChallenges)
      .set({ consumedAt: now })
      .where(and(eq(otpChallenges.identifier, id.value), isNull(otpChallenges.consumedAt)));
    const [row] = await tx
      .insert(otpChallenges)
      .values({ identifier: id.value, channel, codeHash: hash(id.value, code), expiresAt: new Date(now.getTime() + OTP_TTL_MIN * 60_000) })
      .returning({ id: otpChallenges.id });
    return { challengeId: row.id };
  });
  if (claim instanceof ApiError) throw claim;

  try {
    await deliverOtp(channel, id.value, code);
  } catch (e) {
    // الطلب يبقى محسوباً من حدّ الإرسال، لكن الرمز يُبطَل لأنه لم يصل
    await asSystem(null, async (tx) => {
      await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, claim.challengeId));
      await log(tx, id.value, channel, false, 'delivery_failed', meta);
    });
    if (e instanceof ChannelError) {
      throw badRequest('channel_failed', 'تعذّر الإرسال عبر هذه القناة، جرّبي قناة أخرى', { fallbacks });
    }
    throw e;
  }
  await asSystem(null, (tx) => log(tx, id.value, channel, true, 'sent', meta));
  return { channel, fallbacks, resendInSec: OTP_RESEND_SEC, expiresInSec: OTP_TTL_MIN * 60 };
}

/** يتحقق من الرمز ويستهلكه؛ يعيد قناة الإرسال عند النجاح */
export async function verifyOtp(identifier: string, code: string, meta: Meta = {}): Promise<{ channel: OtpChannel }> {
  const now = new Date();
  const clean = code.replace(/\D/g, '');
  const outcome = await asSystem(null, async (tx): Promise<ApiError | { channel: OtpChannel }> => {
    await serialize(tx, identifier);
    const [ch] = await tx
      .select()
      .from(otpChallenges)
      .where(and(eq(otpChallenges.identifier, identifier), isNull(otpChallenges.consumedAt)))
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    if (!ch || ch.expiresAt < now) {
      await log(tx, identifier, ch?.channel ?? 'unknown', false, 'expired', meta);
      return badRequest('code_expired', 'انتهت صلاحية الرمز، اطلبي رمزاً جديداً');
    }
    if (ch.lockedUntil && ch.lockedUntil > now) {
      await log(tx, identifier, ch.channel, false, 'locked', meta);
      return tooMany('تجاوزتِ عدد المحاولات، حاولي بعد 15 دقيقة', secondsUntil(ch.lockedUntil, now));
    }
    const valid = clean.length === 6 && timingSafeEqual(Buffer.from(ch.codeHash, 'hex'), Buffer.from(hash(identifier, clean), 'hex'));
    if (!valid) {
      const attempts = ch.attempts + 1;
      const lockedUntil = attempts >= OTP_MAX_ATTEMPTS ? new Date(now.getTime() + OTP_LOCK_MIN * 60_000) : null;
      await tx.update(otpChallenges).set({ attempts, lockedUntil }).where(eq(otpChallenges.id, ch.id));
      await log(tx, identifier, ch.channel, false, lockedUntil ? 'locked' : 'invalid', meta);
      if (lockedUntil) return tooMany('تجاوزتِ عدد المحاولات، حاولي بعد 15 دقيقة', OTP_LOCK_MIN * 60);
      const remaining = OTP_MAX_ATTEMPTS - attempts;
      const left = remaining === 1 ? 'بقيت محاولة واحدة' : remaining === 2 ? 'بقيت محاولتان' : `بقيت ${remaining} محاولات`;
      return badRequest('code_invalid', `رمز غير صحيح، ${left}`, { remaining });
    }
    await tx.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, ch.id));
    await log(tx, identifier, ch.channel, true, 'verified', meta);
    return { channel: ch.channel };
  });
  if (outcome instanceof ApiError) throw outcome;
  return outcome;
}
