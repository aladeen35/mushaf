// عقد واجهة /api/v1: مخطط Zod لكل نقطة، منه يُتحقق من المدخلات في المقابض،
// ومنه يُولّد ملف OpenAPI (القسم 14) فيبقى التوثيق مطابقاً للكود.
import { z } from 'zod';
import type { Permission } from '@/lib/domain/permissions';

const uuid = z.uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ بصيغة YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'وقت بصيغة HH:MM');
const country = z.string().regex(/^[A-Z]{2}$/).transform((c) => c as import('libphonenumber-js').CountryCode);
const ayahRef = z.object({ surah: z.int().min(1).max(114), ayah: z.int().min(1).max(286) });
const mistakes = z.object({ hifz: z.int().min(0).max(99), tajweed: z.int().min(0).max(99), tashkeel: z.int().min(0).max(99), hesitation: z.int().min(0).max(99) }).partial();

export const S = {
  otpSend: z.union([
    z.object({ phone: z.string().min(6).max(20), country, channel: z.enum(['whatsapp', 'sms']).optional() }),
    z.object({ email: z.email().max(200), country: country.optional() }),
  ]),
  otpVerify: z.union([
    z.object({ phone: z.string().min(6).max(20), country, code: z.string().min(6).max(10) }),
    // الدولة لازمة مع البريد: منها عملة الحساب الجديد ومنطقته الزمنية
    z.object({ email: z.email().max(200), country, code: z.string().min(6).max(10) }),
  ]),
  studentCode: z.object({ code: z.string().min(6).max(12) }),
  google: z.object({ credential: z.string().min(20), country: country.optional() }),

  onboarding: z.object({
    fullName: z.string().trim().min(3).max(80),
    kind: z.enum(['guardian', 'self']),
    city: z.string().max(60).nullish(),
    timezone: z.string().max(60).optional(),
    acceptTerms: z.literal(true),
    self: z.object({ birthDate: isoDate, level: z.string().max(60).nullish(), goal: z.string().max(200).nullish() }).optional(),
  }),
  mePatch: z.object({ fullName: z.string().trim().min(3).max(80).optional(), city: z.string().max(60).nullish(), timezone: z.string().max(60).optional() }),
  notificationPrefs: z.record(z.string(), z.object({ whatsapp: z.boolean(), email: z.boolean(), sms: z.boolean(), push: z.boolean() }).partial()),

  childCreate: z.object({
    fullName: z.string().trim().min(3).max(80),
    displayName: z.string().trim().min(2).max(30).optional(),
    gender: z.enum(['female', 'male']),
    birthDate: isoDate,
    level: z.string().max(60).nullish(),
    goal: z.string().max(200).nullish(),
  }),
  studentPatch: z.object({
    fullName: z.string().trim().min(3).max(80).optional(),
    displayName: z.string().trim().min(2).max(30).optional(),
    birthDate: isoDate.optional(),
    level: z.string().max(60).nullish(),
    goal: z.string().max(200).nullish(),
    teacherId: uuid.nullable().optional(),
  }),
  plan: z.object({
    direction: z.enum(['nas_to_baqarah', 'baqarah_to_nas']),
    start: ayahRef,
    weeklyTargetAyahs: z.int().min(1).max(500),
    newRatio: z.int().min(0).max(100),
  }),

  teachersQuery: z.object({ category: z.enum(['children', 'women']).optional() }),
  application: z.object({
    fullName: z.string().trim().min(3).max(80),
    phone: z.string().min(6).max(20),
    country,
    email: z.email().max(200).nullish(),
    city: z.string().max(60).nullish(),
    ijazah: z.string().trim().min(3).max(300),
    experience: z.string().trim().min(3).max(1000),
    categories: z.array(z.enum(['children', 'women'])).min(1),
  }),
  applicationsQuery: z.object({ status: z.enum(['new', 'under_review', 'needs_info', 'interview', 'accepted', 'rejected']).optional() }),
  applicationStatus: z.object({
    status: z.enum(['under_review', 'needs_info', 'interview', 'accepted', 'rejected']),
    missingInfo: z.string().max(500).optional(),
    interviewAt: z.coerce.date().optional(),
    rejectionReason: z.string().max(500).optional(),
  }),
  availability: z.object({
    timezone: z.string().max(60).optional(),
    windows: z.array(z.object({ weekday: z.int().min(0).max(6), start: hhmm, end: hhmm })).max(42),
  }),

  plansQuery: z.object({ currency: z.enum(['SAR', 'SDG', 'USD']).optional() }),
  order: z.object({
    items: z
      .array(
        z.object({
          studentId: uuid,
          planCode: z.enum(['basic', 'regular', 'intensive']),
          durationMin: z.union([z.literal(30), z.literal(45), z.literal(60)]),
          teacherId: uuid,
          slots: z.array(z.object({ weekday: z.int().min(0).max(6), time: hhmm })).min(1).max(7),
        }),
      )
      .min(1)
      .max(6),
    method: z.enum(['bank_transfer_sa', 'sudan_transfer', 'international_transfer']),
    couponCode: z.string().trim().max(40).optional(),
    onBehalfOf: uuid.optional(),
  }),
  receipt: z.object({ senderName: z.string().trim().min(2).max(80), transferDate: isoDate }),
  couponValidate: z.object({ code: z.string().trim().min(2).max(40), planCodes: z.array(z.enum(['basic', 'regular', 'intensive'])).min(1), subtotal: z.number().nonnegative() }),

  paymentsQuery: z.object({ status: z.enum(['awaiting_transfer', 'under_review', 'approved', 'rejected', 'needs_fix', 'expired']).default('under_review') }),
  reject: z.object({ reason: z.string().trim().min(3).max(300), needsFix: z.boolean().default(false) }),
  refund: z.object({ paymentId: uuid, amount: z.number().positive(), reason: z.string().trim().min(3).max(300) }),

  availabilitySearch: z.object({
    teacherId: uuid,
    durationMin: z.coerce.number().pipe(z.union([z.literal(30), z.literal(45), z.literal(60)])),
    mode: z.enum(['weekly', 'single']).default('weekly'),
    weeks: z.coerce.number().int().min(1).max(8).default(4),
    days: z.coerce.number().int().min(1).max(30).default(14),
    ignoreSessionId: uuid.optional(),
  }),
  sessionsQuery: z.object({ from: z.coerce.date(), to: z.coerce.date(), studentId: uuid.optional() }),
  cancel: z.object({ reason: z.string().trim().min(3).max(300), excused: z.boolean().optional() }),
  reschedule: z.object({ startsAt: z.coerce.date(), reason: z.string().trim().min(3).max(300) }),
  decide: z.object({ accept: z.boolean() }),

  report: z.object({
    attendance: z.enum(['present', 'late', 'absent', 'teacher_absent']),
    grade: z.enum(['excellent', 'very_good', 'good', 'needs_repeat']).optional(),
    guardianNote: z.string().max(280).nullish(),
    internalNote: z.string().max(1000).nullish(),
    segments: z
      .array(z.object({ type: z.enum(['new', 'near_review', 'far_review', 'recitation', 'test']), from: ayahRef, to: ayahRef, homework: z.boolean().optional(), mistakes: mistakes.optional() }))
      .max(12),
  }),

  notificationsQuery: z.object({ cursor: uuid.optional() }),
  notificationsRead: z.union([z.object({ ids: z.array(uuid).min(1).max(100) }), z.object({ all: z.literal(true) })]),

  exportQuery: z.object({ format: z.enum(['csv', 'json']).default('csv'), from: z.coerce.date(), to: z.coerce.date() }),
  auditQuery: z.object({ entity: z.string().max(60).optional(), entityId: z.string().max(80).optional(), before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(200).optional() }),
  impersonate: z.object({ userId: uuid, reason: z.string().trim().min(5).max(300) }),
  fileContent: z.object({ exp: z.coerce.number().int(), sig: z.string().min(10).max(100) }),
};

export type Endpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  auth: 'public' | 'user';
  can?: Permission[];
  body?: z.ZodType;
  query?: z.ZodType;
  multipart?: string[];
  idempotent?: boolean;
};

export const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/auth/otp/send', summary: 'إرسال رمز الدخول (واتساب أولاً، ثم SMS للسعودية أو البريد)', auth: 'public', body: S.otpSend },
  { method: 'POST', path: '/auth/otp/verify', summary: 'التحقق من الرمز وبدء الجلسة', auth: 'public', body: S.otpVerify },
  { method: 'POST', path: '/auth/student-code', summary: 'دخول الطالب القاصر برمز من ولي أمره', auth: 'public', body: S.studentCode },
  { method: 'POST', path: '/auth/google', summary: 'الدخول بحساب Google (خارج السعودية)', auth: 'public', body: S.google },
  { method: 'POST', path: '/auth/logout', summary: 'تسجيل الخروج', auth: 'public' },
  { method: 'GET', path: '/me', summary: 'المستخدم الحالي وأدواره', auth: 'user' },
  { method: 'PATCH', path: '/me', summary: 'تعديل الاسم والمدينة والمنطقة الزمنية', auth: 'user', body: S.mePatch },
  { method: 'POST', path: '/me/onboarding', summary: 'إكمال الحساب: ولي أمر أو طالبة بالغة', auth: 'user', body: S.onboarding },
  { method: 'PUT', path: '/me/notification-preferences', summary: 'تفضيلات الإشعار', auth: 'user', body: S.notificationPrefs },
  { method: 'GET', path: '/students', summary: 'الطلاب المتاحون للمستخدم حسب دوره', auth: 'user' },
  { method: 'POST', path: '/students', summary: 'إضافة ابن أو ابنة', auth: 'user', can: ['students.manage'], body: S.childCreate },
  { method: 'PATCH', path: '/students/{id}', summary: 'تعديل ملف الطالب أو إسناده لمعلمة', auth: 'user', body: S.studentPatch },
  { method: 'GET', path: '/students/{id}/progress', summary: 'خريطة الأجزاء والإتقان والرصيد', auth: 'user' },
  { method: 'GET', path: '/students/{id}/reports', summary: 'تقارير الحصص', auth: 'user' },
  { method: 'PUT', path: '/students/{id}/plan', summary: 'خطة الحفظ', auth: 'user', can: ['reports.write', 'reports.edit'], body: S.plan },
  { method: 'POST', path: '/students/{id}/login-code', summary: 'إصدار رمز دخول للطالب القاصر', auth: 'user', can: ['students.manage'] },
  { method: 'GET', path: '/teachers', summary: 'المعلمات المتاحات للحجز', auth: 'user', query: S.teachersQuery },
  { method: 'POST', path: '/teacher-applications', summary: 'طلب انضمام معلمة', auth: 'public', body: S.application, multipart: ['id_document', 'ijazah', 'certificate', 'recording'] },
  { method: 'GET', path: '/teacher-applications', summary: 'طلبات الانضمام', auth: 'user', can: ['teachers.approve'], query: S.applicationsQuery },
  { method: 'PATCH', path: '/teacher-applications/{id}/status', summary: 'نقل طلب الانضمام لمرحلة', auth: 'user', can: ['teachers.approve'], body: S.applicationStatus },
  { method: 'GET', path: '/teachers/{id}/availability', summary: 'أوقات الإتاحة الأسبوعية', auth: 'user' },
  { method: 'PUT', path: '/teachers/{id}/availability', summary: 'تحديث أوقات الإتاحة', auth: 'user', can: ['availability.manage.own', 'teachers.assign'], body: S.availability },
  { method: 'GET', path: '/plans', summary: 'الباقات وأسعارها بعملة المستخدم', auth: 'public', query: S.plansQuery },
  { method: 'POST', path: '/orders', summary: 'طلب باقة مع حجز المواعيد 72 ساعة', auth: 'user', can: ['plans.purchase', 'plans.purchase.on_behalf'], body: S.order, idempotent: true },
  { method: 'GET', path: '/orders/{ref}', summary: 'تفاصيل الطلب وحساب التحويل', auth: 'user' },
  { method: 'POST', path: '/orders/{ref}/receipt', summary: 'رفع إيصال التحويل', auth: 'user', body: S.receipt, multipart: ['file'], idempotent: true },
  { method: 'POST', path: '/coupons/validate', summary: 'التحقق من كوبون', auth: 'user', body: S.couponValidate },
  { method: 'GET', path: '/payments', summary: 'طابور مراجعة التحويلات', auth: 'user', can: ['payments.approve'], query: S.paymentsQuery },
  { method: 'GET', path: '/payments/{id}', summary: 'الدفعة وإيصالاتها', auth: 'user', can: ['payments.approve'] },
  { method: 'POST', path: '/payments/{id}/approve', summary: 'اعتماد التحويل وتفعيل الباقة', auth: 'user', can: ['payments.approve'], idempotent: true },
  { method: 'POST', path: '/payments/{id}/reject', summary: 'رفض التحويل أو طلب تصحيحه بسبب', auth: 'user', can: ['payments.approve'], body: S.reject },
  { method: 'POST', path: '/refunds', summary: 'تسجيل استرداد', auth: 'user', can: ['payments.refund'], body: S.refund, idempotent: true },
  { method: 'GET', path: '/availability/search', summary: 'المواعيد المتاحة بتوقيت المستخدم', auth: 'user', query: S.availabilitySearch },
  { method: 'GET', path: '/sessions', summary: 'الحصص في مدة', auth: 'user', query: S.sessionsQuery },
  { method: 'POST', path: '/sessions/{id}/cancel', summary: 'إلغاء حصة (مجاني قبل 12 ساعة)', auth: 'user', body: S.cancel },
  { method: 'POST', path: '/sessions/{id}/reschedule', summary: 'إعادة جدولة أو طلبها', auth: 'user', body: S.reschedule },
  { method: 'GET', path: '/sessions/{id}/join', summary: 'تسجيل الحضور والتحويل لرابط الحصة', auth: 'user' },
  { method: 'POST', path: '/sessions/{id}/report', summary: 'تقرير الحصة', auth: 'user', can: ['reports.write', 'reports.edit'], body: S.report },
  { method: 'GET', path: '/reschedule-requests', summary: 'طلبات إعادة الجدولة المعلّقة', auth: 'user' },
  { method: 'POST', path: '/reschedule-requests/{id}/decide', summary: 'قبول طلب إعادة الجدولة أو رفضه', auth: 'user', body: S.decide },
  { method: 'GET', path: '/quran/surahs', summary: 'فهرس السور', auth: 'public' },
  { method: 'GET', path: '/quran/pages/{n}', summary: 'صفحة المصحف بأسطرها', auth: 'public' },
  { method: 'GET', path: '/quran/search', summary: 'بحث بكلمة مع تجاهل التشكيل', auth: 'public' },
  { method: 'GET', path: '/tafsir/{source}/{ayah}', summary: 'تفسير آية (الميسر محلياً)', auth: 'public' },
  { method: 'GET', path: '/notifications', summary: 'الإشعارات بالترقيم بالمؤشر', auth: 'user', query: S.notificationsQuery },
  { method: 'POST', path: '/notifications/read', summary: 'تعليم الإشعارات مقروءة', auth: 'user', body: S.notificationsRead },
  { method: 'GET', path: '/files/{id}', summary: 'رابط موقّع 5 دقائق بعد فحص الملكية', auth: 'user' },
  { method: 'GET', path: '/admin/dashboard', summary: 'مؤشرات الإدارة حسب الدور', auth: 'user' },
  { method: 'GET', path: '/admin/reports/{type}', summary: 'تصدير التقارير CSV', auth: 'user', query: S.exportQuery },
  { method: 'GET', path: '/admin/audit-logs', summary: 'سجل التدقيق', auth: 'user', can: ['audit.read'], query: S.auditQuery },
  { method: 'POST', path: '/admin/impersonate', summary: 'الدخول بحساب مستخدم للدعم', auth: 'user', can: ['support.impersonate'], body: S.impersonate },
  { method: 'DELETE', path: '/admin/impersonate', summary: 'إنهاء الدخول بحساب مستخدم', auth: 'user' },
];

/** ملف OpenAPI 3.1 من العقد نفسه */
export function openApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  const error = { $ref: '#/components/schemas/Error' };
  for (const e of ENDPOINTS) {
    const params = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const query = e.query ? z.toJSONSchema(e.query, { io: 'input', unrepresentable: 'any' }) : null;
    const queryParams = query && 'properties' in query && query.properties
      ? Object.entries(query.properties as Record<string, unknown>).map(([name, schema]) => ({ name, in: 'query', required: ((query.required as string[]) ?? []).includes(name), schema }))
      : [];
    const body = e.body ? z.toJSONSchema(e.body, { io: 'input', unrepresentable: 'any' }) : null;
    paths[e.path] ??= {};
    paths[e.path][e.method.toLowerCase()] = {
      summary: e.summary,
      security: e.auth === 'public' ? [] : [{ session: [] }],
      ...(e.can ? { 'x-permissions': e.can } : {}),
      parameters: [
        ...params,
        ...queryParams,
        ...(e.idempotent ? [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 100 } }] : []),
      ],
      ...(body || e.multipart
        ? {
            requestBody: {
              required: true,
              content: e.multipart
                ? { 'multipart/form-data': { schema: { type: 'object', properties: { ...Object.fromEntries(e.multipart.map((f) => [f, { type: 'string', format: 'binary' }])), ...((body as { properties?: object })?.properties ?? {}) } } } }
                : { 'application/json': { schema: body } },
            },
          }
        : {}),
      responses: {
        '200': { description: 'نجاح', content: { 'application/json': { schema: { type: 'object', properties: { data: {} } } } } },
        '401': { description: 'سجّلي الدخول أولاً', content: { 'application/json': { schema: error } } },
        '403': { description: 'لا صلاحية', content: { 'application/json': { schema: error } } },
        '422': { description: 'بيانات غير صحيحة', content: { 'application/json': { schema: error } } },
        '429': { description: 'طلبات كثيرة', content: { 'application/json': { schema: error } } },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'أكاديمية مآب — API', version: '1.0.0', description: 'واجهة REST واحدة بإصدار /api/v1 تستخدمها واجهة الويب والجوال لاحقاً.' },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'maab_session' } },
      schemas: {
        Error: { type: 'object', required: ['code', 'message_ar'], properties: { code: { type: 'string' }, message_ar: { type: 'string' }, details: {} } },
      },
    },
    paths,
  };
}
