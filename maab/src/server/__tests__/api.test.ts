/*
 * اختبارات تكامل /api/v1 (القسم 17): كل نقطة تُستدعى كما يستدعيها المتصفح،
 * على قاعدة اختبار مستقلة (<TEST_DATABASE_URL>_api) تُبنى من الصفر ببيانات العرض.
 * المسار الكامل: رمز الدخول ← إكمال الحساب ← إضافة ابن ← الحجز ← الإيصال ←
 * اعتماد المالية ← رابط الحصة ← التقرير وإتمام الجزء ← الإلغاء وانتهاء المهلة.
 */
import { execFileSync } from 'node:child_process';
import { and, eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.TEST_DATABASE_URL;
const URL_API = BASE ? BASE.replace(/\/([^/?]+)(\?|$)/, '/$1_api$2') : undefined;

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type CallOpts = { method?: string; body?: unknown; form?: FormData; cookie?: string; params?: Record<string, string>; headers?: Record<string, string>; ip?: string };

let ipSeq = 1;

async function call(handler: Handler, path: string, o: CallOpts = {}) {
  const headers = new Headers(o.headers);
  headers.set('x-forwarded-for', o.ip ?? `10.0.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}`);
  if (o.cookie) headers.set('cookie', o.cookie);
  let body: BodyInit | undefined;
  if (o.form) body = o.form;
  else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    headers.set('content-type', 'application/json');
  }
  const res = await handler(new Request(`http://localhost/api/v1${path}`, { method: o.method ?? (body ? 'POST' : 'GET'), headers, body }), {
    params: Promise.resolve(o.params ?? {}),
  });
  const type = res.headers.get('content-type') ?? '';
  const json = type.includes('json') ? await res.json() : null;
  const set = res.headers.getSetCookie().find((c) => c.startsWith('maab_session='));
  return { res, status: res.status, json, cookie: set ? set.split(';')[0] : undefined };
}

describe.skipIf(!URL_API)('واجهة /api/v1: المسار الكامل', () => {
  let c: typeof import('../db/client');
  let t: typeof import('../db/schema');
  let outbox: typeof import('../auth/channels').devOutbox;
  let session: typeof import('../auth/session');
  const api = {} as Record<string, Record<string, Handler>>;
  const u: Record<string, string> = {};
  const cookies: Record<string, string> = {};

  const lastCode = (to: string) => {
    const m = outbox().find((x) => x.to === to)?.text.match(/(\d{6})/);
    if (!m) throw new Error(`لا رمز مرسل إلى ${to}`);
    return m[1];
  };
  const cookieFor = async (userId: string) => {
    const roles = (await c.getDb().select({ role: t.userRoles.role }).from(t.userRoles).where(eq(t.userRoles.userId, userId))).map((r) => r.role);
    const { token } = await session.signSession({ userId, roles });
    return `maab_session=${token}`;
  };
  const db = () => c.getDb();

  beforeAll(async () => {
    const admin = postgres(BASE!, { max: 1, onnotice: () => {} });
    const name = new URL(URL_API!).pathname.slice(1);
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database "${name}"`);
    await admin.end();
    execFileSync('npx', ['tsx', 'scripts/db/reset-local.ts', '--demo'], { env: { ...process.env, DATABASE_URL: URL_API }, stdio: 'pipe' });
    process.env.DATABASE_URL = URL_API;

    c = await import('../db/client');
    t = await import('../db/schema');
    outbox = (await import('../auth/channels')).devOutbox;
    session = await import('../auth/session');
    const load = async (path: string) => (await import(`../../app/api/v1/${path}/route`)) as Record<string, Handler>;
    for (const p of [
      'auth/otp/send', 'auth/otp/verify', 'auth/student-code', 'auth/google', 'me', 'me/onboarding', 'students', 'students/[id]/reports',
      'students/[id]/progress', 'students/[id]/login-code', 'teachers', 'availability/search', 'orders', 'orders/[ref]', 'orders/[ref]/receipt',
      'payments', 'payments/[id]/approve', 'payments/[id]/reject', 'sessions', 'sessions/[id]/cancel', 'sessions/[id]/report',
      'sessions/[id]/join', 'notifications', 'files/[id]', 'files/[id]/content', 'admin/impersonate', 'admin/dashboard', 'openapi.json', 'plans',
    ]) api[p] = await load(p);

    const rows = await db().select({ id: t.users.id, phone: t.users.phone }).from(t.users);
    const byPhone = Object.fromEntries(rows.map((r) => [r.phone, r.id]));
    Object.assign(u, {
      salma: byPhone['+966512345678'],
      mazahir: byPhone['+249911000101'],
      finance: byPhone['+966500000902'],
      support: byPhone['+249911000903'],
      admin: byPhone['+966500000900'],
      afaf: byPhone['+249912000205'],
    });
    for (const k of ['mazahir', 'finance', 'support', 'afaf']) cookies[k] = await cookieFor(u[k]);
  }, 180_000);

  afterAll(async () => {
    await c?.closeDb();
  });

  // —— رمز الدخول ——

  it('واتساب أولاً للرقم السعودي، والرسالة النصية احتياط', async () => {
    const r = await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone: '0512345678', country: 'SA' } });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ channel: 'whatsapp', fallbacks: ['sms'], to: '+966512345678', expiresInSec: 300 });
    expect(outbox()[0]).toMatchObject({ channel: 'whatsapp', to: '+966512345678' });
    // إعادة الطلب قبل 60 ثانية تُرفض مع Retry-After
    const again = await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone: '+966512345678', country: 'SA' } });
    expect(again.status).toBe(429);
    expect(Number(again.res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('الرقم السوداني: واتساب ثم البريد، ولا رسائل نصية', async () => {
    const r = await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone: '+249 91 200 0201', country: 'SD' } });
    expect(r.json.data).toMatchObject({ channel: 'whatsapp', fallbacks: ['email'] });
    const sms = await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone: '0912000205', country: 'SD', channel: 'sms' } });
    expect(sms.status).toBe(400);
    expect(sms.json.code).toBe('channel_not_allowed');
  });

  it('رمز خاطئ يُنقص المحاولات، والصحيح يفتح الجلسة إلى صفحة ولي الأمر', async () => {
    const wrong = await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { phone: '+966512345678', country: 'SA', code: '000000' } });
    // احتمال تطابق الرمز العشوائي مع 000000 واحد في المليون
    expect(wrong.status).toBe(400);
    expect(wrong.json).toMatchObject({ code: 'code_invalid', details: { remaining: 4 } });
    const ok = await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { phone: '+966512345678', country: 'SA', code: lastCode('+966512345678') } });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ roles: ['guardian'], created: false, next: '/guardian' });
    expect(ok.res.headers.getSetCookie()[0]).toMatch(/HttpOnly; SameSite=Lax/);
    cookies.salma = ok.cookie!;
    // الرمز يُستهلك مرة واحدة
    const replay = await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { phone: '+966512345678', country: 'SA', code: lastCode('+966512345678') } });
    expect(replay.json.code).toBe('code_expired');
  });

  it('خمس محاولات خاطئة تقفل الدخول 15 دقيقة حتى بالرمز الصحيح', async () => {
    const phone = '+971500000204';
    await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone, country: 'AE' } });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { phone, country: 'AE', code: '111111' } })).status);
    expect(statuses).toEqual([400, 400, 400, 400, 429]);
    const right = await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { phone, country: 'AE', code: lastCode(phone) } });
    expect(right.status).toBe(429);
    const resend = await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { phone, country: 'AE' } });
    expect(resend.status).toBe(429);
    const attempts = await db().select().from(t.loginAttempts).where(eq(t.loginAttempts.identifier, phone));
    expect(attempts.filter((a) => !a.success).length).toBeGreaterThanOrEqual(5);
  });

  it('حساب جديد بالبريد من بريطانيا: بالدولار، ثم إكمال الحساب طالبةً بالغة', async () => {
    const email = 'Amna@Example.com';
    await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { email } });
    expect(outbox()[0]).toMatchObject({ channel: 'email', to: 'amna@example.com' });
    const v = await call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { email, country: 'GB', code: lastCode('amna@example.com') } });
    expect(v.json.data).toMatchObject({ created: true, roles: [], next: '/onboarding' });
    const me = await call(api.me.GET, '/me', { cookie: v.cookie });
    expect(me.json.data).toMatchObject({ currency: 'USD', timezone: 'Europe/London', country: 'GB', roles: [] });

    const young = await call(api['me/onboarding'].POST, '/me/onboarding', {
      cookie: v.cookie,
      body: { fullName: 'آمنة عثمان', kind: 'self', acceptTerms: true, self: { birthDate: '2012-01-01' } },
    });
    expect(young.status).toBe(422);
    expect(young.json.code).toBe('not_adult');
    const done = await call(api['me/onboarding'].POST, '/me/onboarding', {
      cookie: v.cookie,
      body: { fullName: 'آمنة عثمان', kind: 'self', acceptTerms: true, self: { birthDate: '1999-03-01' } },
    });
    expect(done.json.data).toMatchObject({ roles: ['adult_student'], next: '/guardian' });
    const list = await call(api.students.GET, '/students', { cookie: done.cookie });
    expect(list.json.data.map((s: { displayName: string }) => s.displayName)).toEqual(['آمنة']);
  });

  // —— الصلاحيات ——

  it('بلا جلسة 401، وولية الأمر لا تصل لطابور المالية 403', async () => {
    expect((await call(api.payments.GET, '/payments')).status).toBe(401);
    const r = await call(api.payments.GET, '/payments', { cookie: cookies.salma });
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ code: 'forbidden', message_ar: expect.any(String) });
  });

  // —— إضافة الابن والحجز ——

  let childId = '';
  let order: { ref: string; total: number; currency: string; payTo: { method: string } };

  it('الأولاد حتى 12 سنة فقط', async () => {
    const year = new Date().getUTCFullYear();
    const old = await call(api.students.POST, '/students', { cookie: cookies.salma, body: { fullName: 'عمر عمر الطيب', gender: 'male', birthDate: `${year - 13}-01-01` } });
    expect(old.status).toBe(422);
    expect(old.json.code).toBe('boy_too_old');
    const ok = await call(api.students.POST, '/students', { cookie: cookies.salma, body: { fullName: 'يوسف عمر الطيب', gender: 'male', birthDate: `${year - 8}-01-01` } });
    expect(ok.status).toBe(200);
    childId = ok.json.data.id;
    const consents = await db().select().from(t.consents).where(eq(t.consents.studentId, childId));
    expect(consents.map((x) => x.kind).sort()).toEqual(['minor_data', 'no_recording']);
  });

  it('الباقات بعملة الحساب: ريال لسلمى، وجنيه لعفاف', async () => {
    const sar = await call(api.plans.GET, '/plans', { cookie: cookies.salma });
    const sdg = await call(api.plans.GET, '/plans', { cookie: cookies.afaf });
    expect(sar.json.data.currency).toBe('SAR');
    expect(sdg.json.data.currency).toBe('SDG');
    expect(sar.json.data.plans.map((p: { code: string }) => p.code)).toEqual(['basic', 'regular', 'intensive']);
  });

  it('حجز الباقة المنتظمة بمواعيد أسبوعية، ومفتاح منع التكرار يعيد الاستجابة نفسها', async () => {
    const teacherId = (await db().select({ id: t.teachers.id }).from(t.teachers).where(eq(t.teachers.userId, u.mazahir)))[0].id;
    const search = await call(api['availability/search'].GET, `/availability/search?teacherId=${teacherId}&durationMin=30&weeks=4`, { cookie: cookies.salma });
    expect(search.status).toBe(200);
    expect(search.json.data.timezone).toBe('Asia/Riyadh');
    const weekly: { weekday: number; time: string }[] = search.json.data.weekly;
    // مزاهر في الخرطوم تُتاح الأحد 13:00–21:00 بتوقيتها، أي 14:00–22:00 بتوقيت الرياض
    const sundays = weekly.filter((w) => w.weekday === 0).map((w) => w.time);
    expect(sundays.length).toBeGreaterThan(0);
    expect(sundays.every((x) => x >= '14:00' && x <= '21:30')).toBe(true);
    const sunday = weekly.find((w) => w.weekday === 0 && w.time >= '18:00')!;
    const tuesday = weekly.find((w) => w.weekday === 2 && w.time >= '18:00')!;
    const body = { items: [{ studentId: childId, planCode: 'regular', durationMin: 30, teacherId, slots: [sunday, tuesday].map(({ weekday, time }) => ({ weekday, time })) }], method: 'bank_transfer_sa' };

    const wrongMethod = await call(api.orders.POST, '/orders', { cookie: cookies.salma, body: { ...body, method: 'sudan_transfer' } });
    expect(wrongMethod.json.code).toBe('method_unavailable');

    const first = await call(api.orders.POST, '/orders', { cookie: cookies.salma, body, headers: { 'Idempotency-Key': 'order-1' } });
    expect(first.status).toBe(200);
    order = first.json.data;
    expect(order).toMatchObject({ currency: 'SAR', status: 'pending_payment', sessionsHeld: 8, payTo: { method: 'bank_transfer_sa' } });
    expect(order.ref).toMatch(/^MAAB-\d{4}-\d{6}$/);
    const replay = await call(api.orders.POST, '/orders', { cookie: cookies.salma, body, headers: { 'Idempotency-Key': 'order-1' } });
    expect(replay.res.headers.get('idempotent-replayed')).toBe('true');
    expect(replay.json.data.ref).toBe(order.ref);
    const held = await db().select().from(t.sessions).where(and(eq(t.sessions.studentId, childId), eq(t.sessions.status, 'held')));
    expect(held).toHaveLength(8);

    // المواعيد نفسها لطالبة أخرى عند المعلمة نفسها: محجوزة
    const kids = await call(api.students.GET, '/students', { cookie: cookies.afaf });
    const clash = await call(api.orders.POST, '/orders', {
      cookie: cookies.afaf,
      body: { ...body, method: 'sudan_transfer', items: [{ ...body.items[0], studentId: kids.json.data[0].id }] },
    });
    expect(clash.status).toBe(409);
    expect(clash.json.code).toBe('slot_taken');
  });

  // —— الإيصال واعتماد المالية ——

  let receiptFileId = '';
  let paymentId = '';

  it('رفع الإيصال يزيل بيانات EXIF ويضع الدفعة قيد المراجعة', async () => {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#fff' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'GPS-SECRET-LOCATION' } } })
      .jpeg()
      .toBuffer();
    expect(jpeg.includes(Buffer.from('GPS-SECRET-LOCATION'))).toBe(true);
    const form = new FormData();
    form.set('file', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'receipt.pdf');
    form.set('senderName', 'سلمى عثمان');
    form.set('transferDate', new Date().toISOString().slice(0, 10));
    const r = await call(api['orders/[ref]/receipt'].POST, `/orders/${order.ref}/receipt`, { cookie: cookies.salma, form, params: { ref: order.ref } });
    expect(r.status).toBe(200);
    expect(r.json.data.paymentStatus).toBe('under_review');

    const detail = await call(api['orders/[ref]'].GET, `/orders/${order.ref}`, { cookie: cookies.salma, params: { ref: order.ref } });
    receiptFileId = detail.json.data.receipts[0].fileId;
    paymentId = detail.json.data.payment.id;
    const signed = await call(api['files/[id]'].GET, `/files/${receiptFileId}`, { cookie: cookies.salma, params: { id: receiptFileId } });
    expect(signed.json.data.mime).toBe('image/jpeg');
    const link = new URL(signed.json.data.url, 'http://localhost');
    const content = await call(api['files/[id]/content'].GET, `${link.pathname.replace('/api/v1', '')}${link.search}`, { params: { id: receiptFileId } });
    expect(content.status).toBe(200);
    const stored = Buffer.from(await content.res.arrayBuffer());
    expect(stored.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(stored.includes(Buffer.from('GPS-SECRET-LOCATION'))).toBe(false);
    const tampered = await call(api['files/[id]/content'].GET, `/files/${receiptFileId}/content?exp=${link.searchParams.get('exp')}&sig=AAAAAAAAAAAAAAAAAAAA`, { params: { id: receiptFileId } });
    expect(tampered.status).toBe(403);
    // ولية أمر أخرى لا ترى الإيصال
    expect((await call(api['files/[id]'].GET, `/files/${receiptFileId}`, { cookie: cookies.afaf, params: { id: receiptFileId } })).status).toBe(404);
  });

  it('المالية تعتمد: اشتراك 8 حصص، والحصص مؤكدة بروابط، وإشعار لولي الأمر', async () => {
    const queue = await call(api.payments.GET, '/payments?status=under_review', { cookie: cookies.finance });
    const row = queue.json.data.find((p: { ref: string }) => p.ref === order.ref);
    expect(row).toMatchObject({ currency: 'SAR', method: 'bank_transfer_sa', students: ['يوسف عمر الطيب'] });
    expect((await call(api['payments/[id]/approve'].POST, `/payments/${paymentId}/approve`, { cookie: cookies.salma, method: 'POST', params: { id: paymentId } })).status).toBe(403);

    const ok = await call(api['payments/[id]/approve'].POST, `/payments/${paymentId}/approve`, { cookie: cookies.finance, method: 'POST', params: { id: paymentId } });
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ status: 'approved', sessionsScheduled: 8 });
    const twice = await call(api['payments/[id]/approve'].POST, `/payments/${paymentId}/approve`, { cookie: cookies.finance, method: 'POST', params: { id: paymentId } });
    expect(twice.status).toBe(409);

    const [sub] = await db().select().from(t.subscriptions).where(eq(t.subscriptions.studentId, childId));
    expect(sub).toMatchObject({ sessionsTotal: 8, sessionsRemaining: 8, status: 'active' });
    const pending = await db().select().from(t.meetings).innerJoin(t.sessions, eq(t.sessions.id, t.meetings.sessionId)).where(eq(t.sessions.studentId, childId));
    expect(pending.map((p) => p.meetings.status)).toEqual(Array(8).fill('pending'));
    const notes = await call(api.notifications.GET, '/notifications', { cookie: cookies.salma });
    expect(notes.json.data.items.find((n: { event: string }) => n.event === 'payment_approved')).toMatchObject({ title: 'اعتُمد التحويل', read: false });
    expect(notes.json.data.unread).toBeGreaterThan(0);
  });

  it('العامل ينشئ الروابط، وزر الدخول يعمل في نافذته فقط ولطرفي الحصة', async () => {
    const { outbox: runOutbox } = await import('../jobs');
    const done = await runOutbox();
    expect(done.meetings.created).toBeGreaterThanOrEqual(8);
    const [s] = await db().select().from(t.sessions).where(eq(t.sessions.studentId, childId)).orderBy(t.sessions.startsAt).limit(1);
    const early = await call(api['sessions/[id]/join'].GET, `/sessions/${s.id}/join`, { cookie: cookies.salma, params: { id: s.id } });
    expect(early.json.code).toBe('join_not_open');
    const outsider = await call(api['sessions/[id]/join'].GET, `/sessions/${s.id}/join`, { cookie: cookies.afaf, params: { id: s.id } });
    expect(outsider.status).toBe(404);

    const { joinSession } = await import('../services/scheduling');
    const { loadViewer } = await import('../api/route');
    const viewer = (await loadViewer(new Request('http://x', { headers: { cookie: cookies.salma } })))!;
    const url = await joinSession(viewer, s.id, new Date(s.startsAt.getTime() - 5 * 60_000));
    expect(url).toMatch(/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
    const list = await call(api.sessions.GET, `/sessions?from=${new Date(Date.now() - 86_400_000).toISOString()}&to=${new Date(Date.now() + 40 * 86_400_000).toISOString()}&studentId=${childId}`, { cookie: cookies.salma });
    expect(list.json.data).toHaveLength(8);
    // رابط Meet لا يظهر في أي استجابة غير نقطة الدخول
    expect(JSON.stringify(list.json)).not.toContain('meet.google.com');
  });

  // —— التقرير وإتمام الجزء ——

  it('تقرير المعلمة يحتسب المحفوظ، ويخصم الرصيد، وإتمام جزء عمّ يرسل «الشرافة»', async () => {
    const [s] = await db().select().from(t.sessions).where(eq(t.sessions.studentId, childId)).orderBy(t.sessions.startsAt).limit(1);
    // الحصة الأولى تصير قبل ساعة، وكان يوسف قد حفظ جزء عمّ إلا أول النبأ
    await c.asSystem(null, async (tx) => {
      await tx.update(t.sessions).set({ startsAt: new Date(Date.now() - 60 * 60_000), endsAt: new Date(Date.now() - 30 * 60_000) }).where(eq(t.sessions.id, s.id));
      const { ayahIndex, juzInfo } = await import('@/lib/quran');
      await tx.insert(t.memorizedRanges).values({ studentId: childId, fromAyah: ayahIndex({ surah: 78, ayah: 17 }), toAyah: ayahIndex(juzInfo(30).to), source: 'placement', memorizedOn: '2026-01-01' });
    });
    const body = {
      attendance: 'present',
      guardianNote: 'ما شاء الله، حفظ متقن',
      internalNote: 'يحتاج تثبيت المدود',
      segments: [
        { type: 'new', from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 16 }, mistakes: { hifz: 1, tajweed: 2 } },
        { type: 'new', from: { surah: 77, ayah: 1 }, to: { surah: 77, ayah: 10 }, homework: true },
      ],
    };
    expect((await call(api['sessions/[id]/report'].POST, `/sessions/${s.id}/report`, { cookie: cookies.salma, body, params: { id: s.id } })).status).toBe(403);
    const r = await call(api['sessions/[id]/report'].POST, `/sessions/${s.id}/report`, { cookie: cookies.mazahir, body, params: { id: s.id } });
    expect(r.status).toBe(200);
    expect(r.json.data).toMatchObject({ mastery: 95, grade: 'excellent', counted: 1, sessionStatus: 'completed', late: false });

    const [sub] = await db().select().from(t.subscriptions).where(eq(t.subscriptions.studentId, childId));
    expect(sub.sessionsRemaining).toBe(7);
    const progress = await call(api['students/[id]/progress'].GET, `/students/${childId}/progress`, { cookie: cookies.salma, params: { id: childId } });
    expect(progress.json.data.completedJuz).toEqual([30]);
    expect(progress.json.data.reviewsDue[0]).toMatchObject({ label: 'النبأ 1–16', step: 0 });
    const notes = await db().select().from(t.notifications).where(and(eq(t.notifications.userId, u.salma), eq(t.notifications.channel, 'in_app')));
    expect(notes.find((n) => n.event === 'juz_completed')).toMatchObject({ title: 'مبروك الشرافة', body: expect.stringContaining('الجزء الثلاثون') });
    expect(notes.find((n) => n.event === 'report_ready')?.body).toContain('النبأ 1–16');

    // الملاحظة الداخلية للمعلمة والمشرفة، لا لولية الأمر
    const forGuardian = await call(api['students/[id]/reports'].GET, `/students/${childId}/reports`, { cookie: cookies.salma, params: { id: childId } });
    expect(forGuardian.json.data[0]).not.toHaveProperty('internalNote');
    expect(forGuardian.json.data[0].segments[0]).toMatchObject({ label: 'النبأ 1–16', counted: true, mistakes: { hifz: 1, tajweed: 2 } });
    const forTeacher = await call(api['students/[id]/reports'].GET, `/students/${childId}/reports`, { cookie: cookies.mazahir, params: { id: childId } });
    expect(forTeacher.json.data[0].internalNote).toBe('يحتاج تثبيت المدود');
  });

  it('الإلغاء قبل 12 ساعة لا يُخصم', async () => {
    const [s] = await db()
      .select()
      .from(t.sessions)
      .where(and(eq(t.sessions.studentId, childId), eq(t.sessions.status, 'scheduled'), sql`${t.sessions.startsAt} > now() + interval '13 hours'`))
      .orderBy(t.sessions.startsAt)
      .limit(1);
    const r = await call(api['sessions/[id]/cancel'].POST, `/sessions/${s.id}/cancel`, { cookie: cookies.salma, body: { reason: 'سفر الأسرة' }, params: { id: s.id } });
    expect(r.json.data).toMatchObject({ status: 'cancelled', deducted: false, inFreeWindow: true });
    const [sub] = await db().select().from(t.subscriptions).where(eq(t.subscriptions.studentId, childId));
    expect(sub.sessionsRemaining).toBe(7);
  });

  it('رفض التحويل يتطلب سبباً ويحرّر المواعيد، والطلب غير المدفوع ينتهي بعد المهلة', async () => {
    const kids = await call(api.students.GET, '/students', { cookie: cookies.afaf });
    const studentId = kids.json.data[0].id;
    const teacherId = (await db().select({ id: t.teachers.id }).from(t.teachers).where(eq(t.teachers.userId, u.mazahir)))[0].id;
    const search = await call(api['availability/search'].GET, `/availability/search?teacherId=${teacherId}&durationMin=45&weeks=4`, { cookie: cookies.afaf });
    const slot = search.json.data.weekly.find((w: { weekday: number }) => w.weekday === 6);
    const body = { items: [{ studentId, planCode: 'basic', durationMin: 45, teacherId, slots: [{ weekday: slot.weekday, time: slot.time }] }], method: 'sudan_transfer' };

    const o1 = await call(api.orders.POST, '/orders', { cookie: cookies.afaf, body });
    expect(o1.json.data).toMatchObject({ currency: 'SDG', payTo: { method: 'sudan_transfer' } });
    const pay = (await call(api['orders/[ref]'].GET, `/orders/${o1.json.data.ref}`, { cookie: cookies.afaf, params: { ref: o1.json.data.ref } })).json.data.payment;
    await c.asSystem(null, (tx) => tx.update(t.payments).set({ status: 'under_review' }).where(eq(t.payments.id, pay.id)));
    const noReason = await call(api['payments/[id]/reject'].POST, `/payments/${pay.id}/reject`, { cookie: cookies.finance, body: {}, params: { id: pay.id } });
    expect(noReason.status).toBe(422);
    const rej = await call(api['payments/[id]/reject'].POST, `/payments/${pay.id}/reject`, { cookie: cookies.finance, body: { reason: 'المبلغ المحوّل أقل من المطلوب' }, params: { id: pay.id } });
    expect(rej.json.data.status).toBe('rejected');
    const freed = await db().select().from(t.sessions).where(eq(t.sessions.studentId, studentId));
    expect(freed.filter((x) => x.status === 'held')).toHaveLength(0);

    // الوقت تحرّر فيُحجز من جديد، ثم يمضي على الطلب 72 ساعة دون دفع
    const o2 = await call(api.orders.POST, '/orders', { cookie: cookies.afaf, body });
    expect(o2.status).toBe(200);
    await c.asSystem(null, (tx) => tx.update(t.orders).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(t.orders.ref, o2.json.data.ref)));
    const { ordersExpire } = await import('../jobs');
    expect(await ordersExpire()).toBe(1);
    const after = await call(api['orders/[ref]'].GET, `/orders/${o2.json.data.ref}`, { cookie: cookies.afaf, params: { ref: o2.json.data.ref } });
    expect(after.json.data).toMatchObject({ status: 'expired', payment: { status: 'expired' } });
  });

  // —— رمز القاصر والدعم ——

  it('ولي الأمر يصدر رمز دخول للقاصر، والقاصر يدخل به', async () => {
    const r = await call(api['students/[id]/login-code'].POST, `/students/${childId}/login-code`, { cookie: cookies.salma, method: 'POST', params: { id: childId } });
    const code: string = r.json.data.code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const bad = await call(api['auth/student-code'].POST, '/auth/student-code', { body: { code: 'ZZZZZZ' } });
    expect(bad.status).toBe(400);
    const ok = await call(api['auth/student-code'].POST, '/auth/student-code', { body: { code: code.toLowerCase() } });
    expect(ok.json.data.next).toBe('/student');
    const mine = await call(api.students.GET, '/students', { cookie: ok.cookie });
    expect(mine.json.data.map((s: { id: string }) => s.id)).toEqual([childId]);
  });

  it('الدعم يدخل بحساب ولي الأمر بسبب مسجّل، ولا يدخل بحساب الإدارة', async () => {
    const no = await call(api['admin/impersonate'].POST, '/admin/impersonate', { cookie: cookies.support, body: { userId: u.admin, reason: 'اختبار الصلاحيات' } });
    expect(no.status).toBe(403);
    const r = await call(api['admin/impersonate'].POST, '/admin/impersonate', { cookie: cookies.support, body: { userId: u.salma, reason: 'مساعدة في رفع الإيصال' } });
    expect(r.status).toBe(200);
    const me = await call(api.me.GET, '/me', { cookie: r.cookie });
    expect(me.json.data).toMatchObject({ id: u.salma, impersonatedBy: u.support });
    const [log] = await db().select().from(t.auditLogs).where(eq(t.auditLogs.action, 'support.impersonate'));
    expect(log).toMatchObject({ actorId: u.support, entityId: u.salma, reason: 'مساعدة في رفع الإيصال' });
    const back = await call(api['admin/impersonate'].DELETE, '/admin/impersonate', { cookie: r.cookie, method: 'DELETE' });
    expect(back.json.data.userId).toBe(u.support);
  });

  it('لوحة الإدارة: الإيرادات لكل عملة لمن يملك صلاحيتها فقط', async () => {
    const fin = await call(api['admin/dashboard'].GET, '/admin/dashboard', { cookie: cookies.finance });
    expect(fin.json.data.revenueMonth.SAR).toBeGreaterThan(0);
    const sup = await call(api['admin/dashboard'].GET, '/admin/dashboard', { cookie: cookies.support });
    expect(sup.json.data).not.toHaveProperty('revenueMonth');
    expect((await call(api['admin/dashboard'].GET, '/admin/dashboard', { cookie: cookies.salma })).status).toBe(403);
  });

  it('ملف OpenAPI يُولَّد من العقد نفسه', async () => {
    const r = await call(api['openapi.json'].GET, '/openapi.json');
    expect(r.json.openapi).toBe('3.1.0');
    expect(Object.keys(r.json.paths)).toEqual(expect.arrayContaining(['/auth/otp/send', '/orders', '/sessions/{id}/report']));
    expect(r.json.paths['/orders'].post.parameters.some((p: { name: string }) => p.name === 'Idempotency-Key')).toBe(true);
  });

  it('الدخول بحساب Google معطّل بلا مفتاح', async () => {
    const r = await call(api['auth/google'].POST, '/auth/google', { body: { credential: 'x'.repeat(40) } });
    expect(r.status).toBe(503);
    expect(r.json.code).toBe('google_disabled');
  });
});
