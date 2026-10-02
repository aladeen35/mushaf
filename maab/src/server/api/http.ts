// صيغة الأخطاء الموحّدة {code, message_ar, details} (القسم 14)، وترجمة أخطاء
// قيود قاعدة البيانات إلى رسائل يفهمها المستخدم بدل رسائل Postgres.
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public messageAr: string,
    public details?: unknown,
  ) {
    super(code);
  }
}

export const unauthorized = () => new ApiError(401, 'unauthorized', 'سجّلي الدخول أولاً');
export const forbidden = () => new ApiError(403, 'forbidden', 'ليست لديكِ صلاحية لهذا الإجراء');
export const notFound = (what = 'العنصر') => new ApiError(404, 'not_found', `${what} غير موجود`);
export const badRequest = (code: string, messageAr: string, details?: unknown) => new ApiError(400, code, messageAr, details);
export const conflict = (code: string, messageAr: string, details?: unknown) => new ApiError(409, code, messageAr, details);
export const tooMany = (messageAr: string, retryAfterSec?: number) =>
  new ApiError(429, 'rate_limited', messageAr, retryAfterSec ? { retryAfterSec } : undefined);

/** قيود القاعدة ورسائلها: الاسم في Postgres ← رمز الخطأ والرسالة العربية */
const CONSTRAINTS: Record<string, [number, string, string]> = {
  sessions_teacher_no_overlap: [409, 'slot_taken', 'هذا الوقت لم يعد متاحاً لدى المعلمة، اختاري وقتاً آخر'],
  sessions_student_no_overlap: [409, 'student_busy', 'للطالب حصة أخرى في هذا الوقت'],
  subscriptions_remaining_ck: [409, 'no_balance', 'لا يكفي رصيد الباقة'],
  boy_too_old: [422, 'boy_too_old', 'الأكاديمية تقبل الأولاد حتى 12 سنة'],
  student_too_young: [422, 'too_young', 'أقل عمر للتسجيل 4 سنوات'],
  teacher_category_mismatch: [422, 'teacher_category', 'المعلمة لا تدرّس هذه الفئة'],
  report_session_mismatch: [403, 'not_your_session', 'التقرير لحصة ليست لكِ'],
  payments_reason_ck: [422, 'reason_required', 'الرفض أو طلب التصحيح يتطلب سبباً'],
  users_phone_uq: [409, 'phone_taken', 'الرقم مسجّل بحساب آخر'],
  users_email_uq: [409, 'email_taken', 'البريد مسجّل بحساب آخر'],
  files_mime_ck: [422, 'file_type', 'نوع الملف أو حجمه غير مسموح'],
  report_segments_range_ck: [422, 'range_invalid', 'نهاية المقطع قبل بدايته'],
  coupon_redemptions_uq: [409, 'coupon_used', 'استُخدم الكوبون في هذا الطلب'],
};

type PgLike = { message?: string; constraint_name?: string; code?: string };

export function fromDbError(e: unknown): ApiError | null {
  const err = e as { cause?: PgLike } & PgLike;
  const pg = err?.cause ?? err;
  const key = pg?.constraint_name ?? Object.keys(CONSTRAINTS).find((k) => pg?.message === k || pg?.message?.includes(k));
  if (key && CONSTRAINTS[key]) {
    const [status, code, msg] = CONSTRAINTS[key];
    return new ApiError(status, code, msg);
  }
  if (pg?.code === '42501') return forbidden();
  return null;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json(
      { code: e.code, message_ar: e.messageAr, details: e.details ?? null },
      { status: e.status, headers: e.status === 429 && e.details ? { 'Retry-After': String((e.details as { retryAfterSec: number }).retryAfterSec) } : undefined },
    );
  }
  if (e instanceof ZodError) {
    return Response.json(
      { code: 'validation', message_ar: 'بيانات غير صحيحة', details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
      { status: 422 },
    );
  }
  const db = fromDbError(e);
  if (db) return errorResponse(db);
  console.error(e);
  return Response.json({ code: 'internal', message_ar: 'حدث خطأ غير متوقع، حاولي مجدداً', details: null }, { status: 500 });
}

/** غلاف مقبض الطلب: يحوّل أي خطأ إلى الصيغة الموحّدة */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export const ok = (data: unknown, init?: ResponseInit) => Response.json({ data }, init);
