// استدعاء /api/v1 من مكوّنات المتصفح. في نسخة العرض الثابتة لا خادم، فتبقى
// النماذج تحاكي النتيجة؛ وفي النسخة الحية تُرسل للخادم وتعرض رسالته بالعربية.

export const IS_LIVE = process.env.NEXT_PUBLIC_MAAB_MODE === 'live';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    public messageAr: string,
    public details: unknown,
  ) {
    super(messageAr);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  /** لعمليات الحجز والدفع: الضغط مرتين يعيد النتيجة نفسها */
  idempotencyKey?: string;
};

export async function api<T>(path: string, o: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.idempotencyKey) headers['idempotency-key'] = o.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: o.method ?? (o.body !== undefined || o.form ? 'POST' : 'GET'),
      headers,
      body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFailure(0, 'network', 'تعذّر الاتصال، تأكدي من الإنترنت وحاولي مجدداً', null);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiFailure(res.status, json?.code ?? 'error', json?.message_ar ?? 'حدث خطأ غير متوقع، حاولي مجدداً', json?.details ?? null);
  }
  return json?.data as T;
}

/** رسالة الخطأ للعرض */
export const errorText = (e: unknown) => (e instanceof ApiFailure ? e.messageAr : 'حدث خطأ غير متوقع، حاولي مجدداً');

/** مفتاح منع تكرار لكل محاولة إرسال نموذج */
export const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
