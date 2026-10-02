/*
 * بذور قاعدة البيانات: npm run db:seed [-- --demo]
 *
 * المرجعية (تُعاد بأمان في كل تشغيل): الأدوار والصلاحيات، الإعدادات والتفعيل
 * التدريجي، الباقات وأسعارها بالعملات الثلاث، حسابات الاستلام، جدول السور
 * والآيات الـ6236، التفسير الميسّر، الأذكار، قوالب الإشعارات.
 *
 * العرض (--demo، على قاعدة فارغة فقط): الأسرة والمعلمات والحصص والتقارير
 * والتحويلات كما في واجهة العرض، مُزاحةً بأسابيع كاملة لتبقى المواعيد قريبة من اليوم.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { count, sql } from 'drizzle-orm';
import { closeDb, getDb, type Tx } from '../../src/server/db/client';
import * as t from '../../src/server/db/schema';
import { DURATIONS, PLANS } from '../../src/lib/domain/billing';
import { DEFAULT_WEIGHTS, mastery } from '../../src/lib/domain/mastery';
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, type Role } from '../../src/lib/domain/permissions';
import { MAX_BOY_AGE } from '../../src/lib/domain/students';
import { FLAGS } from '../../src/lib/flags';
import { ayahIndex, juzOf, type AyahRef } from '../../src/lib/quran';
import surahs from '../../src/lib/quran/surahs.json';
import ayahRows from '../../src/lib/quran/ayahs.json';
import resolve from '../../src/lib/quran/tafsir/resolve.json';
import adhkar from '../../src/lib/content/adhkar.json';
import * as demo from '../../src/lib/demo/data';

const WEEK = 7 * 86_400_000;
const withDemo = process.argv.includes('--demo');

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

const FLAG_NOTES: Record<keyof typeof FLAGS, string> = {
  electronic_payment: 'الدفع الإلكتروني عبر بوابة دفع (المرحلة الثانية)',
  whatsapp: 'إشعارات واتساب بقوالب معتمدة (رمز الدخول عبر واتساب مفعّل دائماً)',
  group_halaqat: 'الحلقات الجماعية',
  e_tests: 'الاختبارات الإلكترونية',
  certificates: 'شهادات الإتمام',
  rewards: 'نقاط التحفيز والمسابقات',
  english_ui: 'الواجهة الإنجليزية',
  smart_review_assistant: 'مساعد المراجعة الذكي',
  minor_student_login: 'دخول الطالب القاصر برمز من ولي الأمر',
};

const SETTINGS: { key: string; value: unknown; description: string }[] = [
  { key: 'max_boy_age', value: MAX_BOY_AGE, description: 'أقصى عمر لقبول الأولاد' },
  { key: 'mastery_weights', value: DEFAULT_WEIGHTS, description: 'أوزان أخطاء نسبة الإتقان' },
  { key: 'memorized_threshold', value: 70, description: 'أدنى نسبة إتقان ليُحتسب المقطع محفوظاً' },
  { key: 'free_cancel_hours', value: 12, description: 'مهلة الإلغاء المجاني وإعادة الجدولة' },
  { key: 'self_reschedules_per_month', value: 2, description: 'إعادة الجدولة الذاتية لولي الأمر شهرياً' },
  { key: 'join_window', value: { beforeMin: 10, afterMin: 15 }, description: 'نافذة زر الدخول للحصة' },
  { key: 'session_buffer_minutes', value: 5, description: 'الفاصل الإلزامي بين الحصص' },
  { key: 'report_deadline_hours', value: 12, description: 'مهلة كتابة تقرير الحصة' },
  { key: 'payment_hold_hours', value: 72, description: 'إلغاء الطلب غير المدفوع' },
  { key: 'otp', value: { ttlMinutes: 5, maxAttempts: 5, lockMinutes: 15, resendSeconds: 60 }, description: 'رمز الدخول' },
  { key: 'admin_idle_minutes', value: 30, description: 'انتهاء جلسة الإدارة بعد الخمول' },
];

const TEMPLATES: { event: string; title: string; body: string }[] = [
  { event: 'otp', title: 'رمز الدخول', body: 'رمز دخولك إلى مآب: {{code}}. صالح 5 دقائق، ولا تشاركيه مع أحد.' },
  { event: 'session_reminder_24h', title: 'تذكير بحصة الغد', body: 'حصة {{student}} مع {{teacher}} غدًا {{time}}.' },
  { event: 'session_reminder_1h', title: 'الحصة بعد ساعة', body: 'حصة {{student}} {{time}}. يظهر زر الدخول قبل الموعد بعشر دقائق.' },
  { event: 'report_ready', title: 'تقرير الحفظ جاهز', body: '{{student}}: {{range}}، تقدير {{grade}}.' },
  { event: 'payment_approved', title: 'اعتُمد التحويل', body: 'فُعّلت باقة {{student}}، والحصص في جدولك.' },
  { event: 'payment_rejected', title: 'التحويل يحتاج مراجعة', body: 'الطلب {{ref}}: {{reason}}' },
  { event: 'balance_low', title: 'رصيد الباقة منخفض', body: 'بقي في باقة {{student}} {{remaining}}.' },
  { event: 'juz_completed', title: 'مبروك الشرافة', body: 'أتمّ {{student}} {{juz}}، ربنا يجعله في ميزان حسناتكم.' },
];

async function seedReference(tx: Tx) {
  await tx
    .insert(t.roles)
    .values((Object.keys(ROLES) as Role[]).map((key) => ({ key, nameAr: ROLES[key] })))
    .onConflictDoUpdate({ target: t.roles.key, set: { nameAr: sql`excluded.name_ar` } });
  await tx
    .insert(t.permissions)
    .values(Object.entries(PERMISSIONS).map(([key, description]) => ({ key, description })))
    .onConflictDoUpdate({ target: t.permissions.key, set: { description: sql`excluded.description` } });
  await tx.delete(t.rolePermissions);
  await tx.insert(t.rolePermissions).values(
    (Object.keys(ROLE_PERMISSIONS) as Role[]).flatMap((role) => ROLE_PERMISSIONS[role].map((permission) => ({ role, permission }))),
  );
  await tx
    .insert(t.settings)
    .values(SETTINGS)
    .onConflictDoUpdate({ target: t.settings.key, set: { description: sql`excluded.description` } });
  await tx
    .insert(t.featureFlags)
    .values(Object.entries(FLAGS).map(([key, enabled]) => ({ key, enabled, description: FLAG_NOTES[key as keyof typeof FLAGS] })))
    .onConflictDoNothing();

  await tx
    .insert(t.plans)
    .values(PLANS.map((p) => ({ code: p.id, nameAr: p.name, sessionsCount: p.sessions, perWeek: p.perWeek, rolloverMax: p.rollover })))
    .onConflictDoNothing();
  const plans = await tx.select().from(t.plans);
  const [{ n: priced }] = await tx.select({ n: count() }).from(t.planPrices);
  if (!priced) {
    await tx.insert(t.planPrices).values(
      (Object.keys(demo.PRICES) as (keyof typeof demo.PRICES)[]).flatMap((currency) =>
        plans.flatMap((p) =>
          DURATIONS.map((durationMin) => ({
            planId: p.id,
            durationMin,
            currency,
            amount: demo.PRICES[currency][p.code as keyof (typeof demo.PRICES)['SAR']][durationMin],
          })),
        ),
      ),
    );
  }
  const [{ n: accounts }] = await tx.select({ n: count() }).from(t.paymentAccounts);
  if (!accounts) {
    await tx.insert(t.paymentAccounts).values(
      demo.PAYMENT_ACCOUNTS.map((a, sort) => ({
        method: a.method,
        currency: a.currency,
        titleAr: a.title,
        bankName: a.bankName,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        instructionsAr: `${a.instructions} (بيانات تجريبية — تستبدلها المالية)`,
        sort,
      })),
    );
  }

  await tx
    .insert(t.quranSurahs)
    .values(surahs.map((s) => ({ id: s.id, nameAr: s.name, ayahCount: s.ayahs, place: s.place, startPage: s.startPage })))
    .onConflictDoNothing();
  const [{ n: ayahCount }] = await tx.select({ n: count() }).from(t.quranAyahs);
  if (ayahCount < 6236) {
    const rows = (ayahRows as [number, number, number, string, string][]).map(([surah, ayah, page, text, key]) => ({
      id: ayahIndex({ surah, ayah }),
      surahId: surah,
      ayahNumber: ayah,
      juz: juzOf({ surah, ayah }),
      page,
      text,
      searchKey: key,
    }));
    await chunked(rows, 500, (part) => tx.insert(t.quranAyahs).values(part).onConflictDoNothing());
  }

  const [source] = await tx
    .insert(t.tafsirSources)
    .values({ key: 'muyassar', nameAr: 'التفسير الميسّر', sourceNote: 'مجمع الملك فهد لطباعة المصحف الشريف' })
    .onConflictDoUpdate({ target: t.tafsirSources.key, set: { nameAr: sql`excluded.name_ar` } })
    .returning();
  const [{ n: tafsirCount }] = await tx.select({ n: count() }).from(t.tafsirEntries);
  if (!tafsirCount) {
    // كل مدخل يشمل الآيات التي تحيل إليه؛ ونصّه في ملف جزء آيته الأولى
    const ranges = new Map<string, { from: number; to: number }>();
    for (const [ref, key] of Object.entries(resolve as Record<string, string>)) {
      const [s, a] = ref.split(':').map(Number);
      const i = ayahIndex({ surah: s, ayah: a });
      const r = ranges.get(key);
      ranges.set(key, r ? { from: Math.min(r.from, i), to: Math.max(r.to, i) } : { from: i, to: i });
    }
    const byJuz = new Map<number, Record<string, string>>();
    const rows: (typeof t.tafsirEntries.$inferInsert)[] = [];
    for (const [key, r] of ranges) {
      const [s, a] = key.split(':').map(Number);
      const juz = juzOf({ surah: s, ayah: a });
      if (!byJuz.has(juz)) {
        byJuz.set(juz, JSON.parse(readFileSync(`src/lib/quran/tafsir/juz-${String(juz).padStart(2, '0')}.json`, 'utf8')));
      }
      const text = byJuz.get(juz)![key];
      if (text) rows.push({ sourceId: source.id, fromAyah: r.from, toAyah: r.to, text });
    }
    await chunked(rows, 400, (part) => tx.insert(t.tafsirEntries).values(part));
  }

  const [{ n: azkarCount }] = await tx.select({ n: count() }).from(t.azkar);
  if (!azkarCount) {
    await tx.insert(t.azkar).values(
      adhkar.flatMap((section) =>
        section.items.map((item, position) => ({
          section: section.key,
          position,
          text: item.text,
          repeatCount: item.count,
          virtue: item.virtue ?? null,
          published: true,
        })),
      ),
    );
  }

  await tx
    .insert(t.notificationTemplates)
    .values(
      TEMPLATES.flatMap((tpl) =>
        (['in_app', 'whatsapp', 'email', 'sms'] as const).map((channel) => ({ event: tpl.event, channel, title: tpl.title, body: tpl.body })),
      ),
    )
    .onConflictDoNothing();
}

// ——— العرض ———

async function seedDemo(tx: Tx) {
  const [{ n: users }] = await tx.select({ n: count() }).from(t.users);
  if (users) {
    console.log('… توجد حسابات، فتُترك بيانات العرض كما هي');
    return;
  }
  const shift = Math.round((Date.now() - demo.DEMO_NOW.getTime()) / WEEK) * WEEK;
  const at = (iso: string) => new Date(Date.parse(iso) + shift);
  const day = (iso: string) => at(iso).toISOString().slice(0, 10);
  const ids = new Map<string, string>();
  const uid = (key: string) => {
    if (!ids.has(key)) ids.set(key, randomUUID());
    return ids.get(key)!;
  };
  const ayah = (r: AyahRef) => ayahIndex(r);
  const plans = Object.fromEntries((await tx.select().from(t.plans)).map((p) => [p.code, p]));

  type Person = { key: string; name: string; phone: string; country: string; tz: string; currency: 'SAR' | 'SDG' | 'USD'; roles: Role[]; email?: string };
  const people: Person[] = [
    { key: 'u:g1', name: demo.guardian.name, phone: demo.guardian.phone, email: demo.guardian.email, country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['guardian'] },
    { key: 'u:t1', name: 'مزاهر عبدالرحيم', phone: '+249911000101', country: 'SD', tz: 'Africa/Khartoum', currency: 'SDG', roles: ['teacher'] },
    { key: 'u:t2', name: 'هبة الأمين', phone: '+966500000102', country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['teacher'] },
    { key: 'u:t3', name: 'أسماء النور', phone: '+249911000103', country: 'SD', tz: 'Africa/Khartoum', currency: 'SDG', roles: ['teacher'] },
    { key: 'u:s3', name: 'ملاذ حسن', phone: '+249912000201', country: 'SD', tz: 'Africa/Khartoum', currency: 'SDG', roles: ['guardian', 'adult_student'] },
    { key: 'u:p4', name: 'نعمات إبراهيم', phone: '+966500000202', country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['guardian'] },
    { key: 'u:s5', name: 'إسراء الفاتح', phone: '+971500000203', country: 'AE', tz: 'Asia/Dubai', currency: 'USD', roles: ['guardian', 'adult_student'] },
    { key: 'u:p6', name: 'ابتهال المهدي', phone: '+971500000204', country: 'AE', tz: 'Asia/Dubai', currency: 'USD', roles: ['guardian'] },
    { key: 'u:p7', name: 'عفاف صالح', phone: '+249912000205', country: 'SD', tz: 'Africa/Khartoum', currency: 'SDG', roles: ['guardian'] },
    { key: 'u:sup', name: 'نجلاء البشير', phone: '+966500000901', country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['supervisor'] },
    { key: 'u:fin', name: 'سعاد عبدالله', phone: '+966500000902', country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['finance'] },
    { key: 'u:sup2', name: 'رشا يوسف', phone: '+249911000903', country: 'SD', tz: 'Africa/Khartoum', currency: 'SDG', roles: ['support'] },
    { key: 'u:admin', name: 'المدير العام', phone: '+966500000900', email: 'admin@maab.example', country: 'SA', tz: 'Asia/Riyadh', currency: 'SAR', roles: ['super_admin'] },
  ];
  await tx.insert(t.users).values(
    people.map((p) => ({ id: uid(p.key), fullName: p.name, phone: p.phone, email: p.email, country: p.country, timezone: p.tz, currency: p.currency, city: p.country === 'SD' ? 'الخرطوم' : p.country === 'AE' ? 'دبي' : 'الرياض' })),
  );
  await tx.insert(t.userRoles).values(people.flatMap((p) => p.roles.map((role) => ({ userId: uid(p.key), role }))));

  const guardiansOf = people.filter((p) => p.roles.includes('guardian'));
  await tx.insert(t.guardians).values(guardiansOf.map((p) => ({ id: uid(`g:${p.key}`), userId: uid(p.key) })));

  await tx.insert(t.teachers).values(
    demo.teachers.map((te) => ({
      id: uid(te.id),
      userId: uid(`u:${te.id}`),
      displayName: te.name,
      headline: te.headline,
      riwayah: te.riwayah,
      categories: te.categories,
      timezone: people.find((p) => p.key === `u:${te.id}`)!.tz,
    })),
  );
  // أوقات الإتاحة بتوقيت كل معلمة (0 = الأحد)
  const windows: [string, number, string, string][] = [
    ['t1', 0, '13:00', '21:00'], ['t1', 1, '16:00', '20:00'], ['t1', 2, '13:00', '21:00'], ['t1', 4, '16:00', '21:00'], ['t1', 6, '10:00', '14:00'],
    ['t2', 0, '16:00', '19:00'], ['t2', 1, '17:00', '20:00'], ['t2', 3, '16:00', '19:00'], ['t2', 4, '16:00', '19:00'],
    ['t3', 1, '20:00', '22:00'], ['t3', 3, '20:00', '22:00'], ['t3', 6, '09:00', '12:00'],
  ];
  await tx.insert(t.teacherAvailability).values(windows.map(([te, weekday, startTime, endTime]) => ({ teacherId: uid(te), weekday, startTime, endTime })));

  // الطلاب: أسرة سلمى، وطالبات المعلمة مزاهر من أسر أخرى
  type Kid = { key: string; full: string; display: string; gender: 'female' | 'male'; birth: string; teacher: string; guardian: string; self?: boolean; level?: string };
  const kids: Kid[] = [
    ...demo.students.map((s) => ({ key: s.id, full: s.fullName, display: s.name, gender: s.gender, birth: s.birthDate, teacher: s.teacherId, guardian: 'u:g1', level: s.level })),
    { key: 's3', full: 'ملاذ حسن', display: 'ملاذ', gender: 'female', birth: '1998-06-01', teacher: 't1', guardian: 'u:s3', self: true },
    { key: 's4', full: 'تسنيم إبراهيم', display: 'تسنيم', gender: 'female', birth: '2018-02-10', teacher: 't1', guardian: 'u:p4' },
    { key: 's5', full: 'إسراء الفاتح', display: 'إسراء', gender: 'female', birth: '1994-11-20', teacher: 't1', guardian: 'u:s5', self: true },
    { key: 's6', full: 'آلاء المهدي', display: 'آلاء', gender: 'female', birth: '2016-04-15', teacher: 't1', guardian: 'u:p6' },
    { key: 's7', full: 'هديل صالح', display: 'هديل', gender: 'female', birth: '2019-01-08', teacher: 't1', guardian: 'u:p7' },
  ];
  await tx.insert(t.students).values(
    kids.map((k) => ({ id: uid(k.key), userId: k.self ? uid(k.guardian) : null, fullName: k.full, displayName: k.display, gender: k.gender, birthDate: k.birth, teacherId: uid(k.teacher), level: k.level })),
  );
  await tx.insert(t.guardianStudents).values(kids.map((k) => ({ guardianId: uid(`g:${k.guardian}`), studentId: uid(k.key), relation: k.self ? 'self' : 'parent' })));
  await tx.insert(t.consents).values(
    guardiansOf.flatMap((p) => [
      { userId: uid(p.key), kind: 'terms' as const, version: '2026-10' },
      { userId: uid(p.key), kind: 'privacy' as const, version: '2026-10' },
      { userId: uid(p.key), kind: 'no_recording' as const, version: '2026-10' },
    ]),
  );
  await tx.insert(t.consents).values(kids.filter((k) => !k.self).map((k) => ({ userId: uid(k.guardian), studentId: uid(k.key), kind: 'minor_data' as const, version: '2026-10' })));

  // خطط الحفظ والمحفوظ عند التسجيل
  await tx.insert(t.memorizationPlans).values(
    demo.students.map((s) => ({ studentId: uid(s.id), direction: s.plan.direction, startAyah: ayah({ surah: 114, ayah: 1 }), weeklyTargetAyahs: s.plan.weeklyTarget, newRatio: s.plan.newRatio, setBy: uid(`u:${s.teacherId}`) })),
  );

  // الطلبات والتحويلات
  const guardianPayments = demo.payments.map((p) => ({ ...p, payerKey: 'u:g1', studentKey: p.studentId, teacher: demo.students.find((s) => s.id === p.studentId)!.teacherId }));
  const studentKeyByName: Record<string, string> = { 'ملاذ حسن': 's3', 'تسنيم إبراهيم': 's4', 'إسراء الفاتح': 's5', 'آلاء المهدي': 's6', 'هديل صالح': 's7' };
  const payerKeyByName: Record<string, string> = { 'ملاذ حسن': 'u:s3', 'نعمات إبراهيم': 'u:p4', 'إسراء الفاتح': 'u:s5', 'ابتهال المهدي': 'u:p6', 'عفاف صالح': 'u:p7' };
  const otherPayments = demo.pendingPayments
    .filter((p) => !guardianPayments.some((g) => g.ref === p.ref))
    .map((p) => ({
      ref: p.ref,
      studentId: studentKeyByName[p.student],
      plan: p.plan,
      duration: p.duration,
      amount: p.amount,
      currency: p.currency,
      method: p.method,
      status: 'under_review' as const,
      createdAt: p.uploadedAt,
      receipt: { fileName: p.file, senderName: p.senderName, transferDate: p.uploadedAt.slice(0, 10), uploadedAt: p.uploadedAt },
      payerKey: payerKeyByName[p.payer],
      studentKey: studentKeyByName[p.student],
      teacher: 't1',
    }));
  const accounts = await tx.select().from(t.paymentAccounts);
  const maxSeq = Math.max(...[...guardianPayments, ...otherPayments].map((p) => Number(p.ref.slice(-6))));
  await tx.insert(t.refCounters).values({ year: 2026, last: maxSeq }).onConflictDoUpdate({ target: t.refCounters.year, set: { last: maxSeq } });

  for (const p of [...guardianPayments, ...otherPayments]) {
    const plan = plans[p.plan];
    const created = at(p.createdAt);
    const approved = p.status === 'approved';
    await tx.insert(t.orders).values({
      id: uid(`o:${p.ref}`),
      ref: p.ref,
      guardianId: uid(`g:${p.payerKey}`),
      currency: p.currency,
      subtotal: p.amount,
      total: p.amount,
      status: approved ? 'paid' : 'pending_payment',
      holdExpiresAt: new Date(created.getTime() + 72 * 3_600_000),
      createdAt: created,
    });
    await tx.insert(t.orderItems).values({ id: uid(`oi:${p.ref}`), orderId: uid(`o:${p.ref}`), studentId: uid(p.studentKey), planId: plan.id, teacherId: uid(p.teacher), durationMin: p.duration, unitPrice: p.amount });
    await tx.insert(t.payments).values({
      id: uid(`p:${p.ref}`),
      orderId: uid(`o:${p.ref}`),
      method: p.method,
      accountId: accounts.find((a) => a.method === p.method)?.id,
      currency: p.currency,
      amount: p.amount,
      status: p.status,
      reviewedBy: approved ? uid('u:fin') : null,
      reviewedAt: approved ? new Date(created.getTime() + 3_600_000) : null,
      createdAt: created,
    });
    if (p.receipt) {
      const ext = p.receipt.fileName.split('.').pop()!;
      await tx.insert(t.files).values({
        id: uid(`f:${p.ref}`),
        ownerId: uid(p.payerKey),
        kind: 'receipt',
        bucket: 'receipts',
        path: `${p.ref}/${randomUUID()}.${ext}`,
        mime: ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg',
        sizeBytes: 180_000,
        sha256: randomUUID().replace(/-/g, ''),
        createdAt: at(p.receipt.uploadedAt),
      });
      await tx.insert(t.paymentReceipts).values({ paymentId: uid(`p:${p.ref}`), fileId: uid(`f:${p.ref}`), senderName: p.receipt.senderName, transferDate: day(p.receipt.uploadedAt), uploadedBy: uid(p.payerKey), createdAt: at(p.receipt.uploadedAt) });
    }
  }

  // الاشتراكات الفعّالة لأسرة سلمى (المعتمدة الأحدث لكل طالب)
  for (const s of demo.students) {
    const pay = guardianPayments.filter((p) => p.studentId === s.id && p.status === 'approved').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    await tx.insert(t.subscriptions).values({
      id: uid(`sub:${s.id}`),
      orderItemId: uid(`oi:${pay.ref}`),
      studentId: uid(s.id),
      planId: plans[s.subscription.plan].id,
      durationMin: s.subscription.duration,
      sessionsTotal: s.subscription.total,
      sessionsRemaining: s.subscription.remaining,
      startsAt: at(s.subscription.startedAt),
      expiresAt: at(s.subscription.expiresAt),
    });
  }

  // الحصص: أسرة سلمى، وحصص المعلمة مزاهر اليوم، وحصص بلا تقرير بعد
  const sessionRows: (typeof t.sessions.$inferInsert)[] = demo.sessions.map((se) => ({
    id: uid(se.id),
    subscriptionId: uid(`sub:${se.studentId}`),
    studentId: uid(se.studentId),
    teacherId: uid(se.teacherId),
    startsAt: at(se.startsAt),
    endsAt: new Date(at(se.startsAt).getTime() + se.durationMin * 60_000),
    blockedUntil: new Date(at(se.startsAt).getTime() + (se.durationMin + 5) * 60_000),
    status: se.status,
  }));
  const rosterKey: Record<string, string> = { ts1: 's3', ts2: 's4', ts4: 's5', ts0: 's7', tsy: 's6' };
  for (const se of [...demo.teacherToday.filter((x) => x.id !== 'x04'), ...demo.teacherPendingReports.map((x) => ({ ...x, id: x.sessionId }))]) {
    const start = at(se.startsAt);
    sessionRows.push({ id: uid(se.id), studentId: uid(rosterKey[se.id]), teacherId: uid('t1'), startsAt: start, endsAt: new Date(start.getTime() + se.durationMin * 60_000), blockedUntil: new Date(start.getTime() + (se.durationMin + 5) * 60_000), status: 'scheduled' });
  }
  await tx.insert(t.sessions).values(sessionRows);
  await tx.insert(t.meetings).values(
    sessionRows.filter((s) => s.status === 'scheduled').map((s) => ({ sessionId: s.id!, provider: 'mock', status: 'created' as const, joinUrl: `https://meet.google.com/demo-${s.id!.slice(0, 3)}-${s.id!.slice(4, 8)}`, externalEventId: `demo-${s.id}` })),
  );
  for (const se of demo.sessions.filter((x) => x.reschedule)) {
    await tx.insert(t.rescheduleRequests).values({ sessionId: uid(se.id), requestedBy: uid(`u:${se.teacherId}`), proposedStartsAt: at(se.reschedule!.proposedAt), reason: se.reschedule!.reason });
  }

  // التقارير والمقاطع والأخطاء والمحفوظ الناتج عنها
  for (const r of demo.reports) {
    const se = demo.sessions.find((x) => x.id === r.sessionId)!;
    const segs = r.segments.map((sg) => ({ ...sg, pct: mastery(sg.mistakes) }));
    const total = segs.reduce((n, sg) => n + ayah(sg.to) - ayah(sg.from) + 1, 0);
    const avg = segs.reduce((n, sg) => n + sg.pct * (ayah(sg.to) - ayah(sg.from) + 1), 0) / total;
    await tx.insert(t.sessionReports).values({ id: uid(r.id), sessionId: uid(r.sessionId), teacherId: uid(r.teacherId), studentId: uid(r.studentId), attendance: r.attendance, grade: r.grade, mastery: Math.round(avg * 100) / 100, guardianNote: r.guardianNote, createdAt: at(r.writtenAt) });
    if (r.internalNote) await tx.insert(t.reportInternalNotes).values({ reportId: uid(r.id), note: r.internalNote, authorId: uid(`u:${r.teacherId}`) });
    let position = 0;
    for (const sg of segs) {
      const segId = randomUUID();
      await tx.insert(t.reportSegments).values({ id: segId, reportId: uid(r.id), position: position++, type: sg.type, fromAyah: ayah(sg.from), toAyah: ayah(sg.to), mastery: sg.pct, counted: sg.pct >= 70 });
      await tx.insert(t.segmentMistakes).values((Object.keys(sg.mistakes) as (keyof typeof sg.mistakes)[]).map((kind) => ({ segmentId: segId, kind, count: sg.mistakes[kind] })));
      if (sg.type === 'new' && sg.pct >= 70) {
        await tx.insert(t.memorizedRanges).values({ studentId: uid(r.studentId), fromAyah: ayah(sg.from), toAyah: ayah(sg.to), source: 'report', segmentId: segId, memorizedOn: day(se.startsAt) });
      }
    }
    for (const hw of r.homework) {
      await tx.insert(t.reportSegments).values({ reportId: uid(r.id), position: position++, type: hw.type, fromAyah: ayah(hw.from), toAyah: ayah(hw.to), homework: true });
    }
  }
  // ما حُفظ قبل المنصة (مستوى التسجيل) = المحفوظ في بيانات العرض ناقصاً ما جاءت به التقارير
  for (const s of demo.students) {
    const fromReports = demo.reports
      .filter((r) => r.studentId === s.id)
      .flatMap((r) => r.segments.filter((sg) => sg.type === 'new' && mastery(sg.mistakes) >= 70))
      .map((sg) => [ayah(sg.from), ayah(sg.to)] as const);
    for (const m of s.memorized) {
      let pieces: [number, number][] = [[ayah(m.from), ayah(m.to)]];
      for (const [a, b] of fromReports) {
        pieces = pieces.flatMap(([x, y]): [number, number][] => {
          if (b < x || a > y) return [[x, y]];
          return [...(a > x ? [[x, a - 1] as [number, number]] : []), ...(b < y ? [[b + 1, y] as [number, number]] : [])];
        });
      }
      for (const [fromAyah, toAyah] of pieces) {
        await tx.insert(t.memorizedRanges).values({ studentId: uid(s.id), fromAyah, toAyah, source: 'placement', memorizedOn: day(s.subscription.startedAt) });
      }
    }
  }

  await tx.insert(t.notifications).values(
    demo.notifications.map((n) => ({ userId: uid('u:g1'), event: n.kind, channel: 'in_app' as const, title: n.title, body: n.body, status: n.read ? ('read' as const) : ('sent' as const), readAt: n.read ? at(n.at) : null, sentAt: at(n.at), createdAt: at(n.at) })),
  );
  await tx.insert(t.teacherApplications).values(
    demo.applications.map((a) => ({
      fullName: a.name,
      phone: `+2499130000${a.id.slice(1).padStart(2, '0')}`,
      country: ['الرياض', 'جدة'].includes(a.city) ? 'SA' : a.city === 'دبي' ? 'AE' : 'SD',
      city: a.city,
      ijazah: `${a.riwayah}`,
      experience: `${a.experienceYears} سنوات في التحفيظ`,
      categories: ['children' as const],
      status: a.status,
      missingInfo: a.missing,
      interviewAt: a.interviewAt ? at(a.interviewAt) : null,
      rejectionReason: a.status === 'rejected' ? 'لم تجتز مقابلة التسميع' : null,
      createdAt: at(a.submittedAt),
    })),
  );
  await tx.insert(t.teacherRatings).values([
    { teacherId: uid('t1'), guardianId: uid('g:u:g1'), month: '2026-09-01', score: 5, comment: 'ما شاء الله، رؤى بقت تحب الحصة' },
    { teacherId: uid('t2'), guardianId: uid('g:u:g1'), month: '2026-09-01', score: 5 },
  ]);
  await tx.insert(t.auditLogs).values([
    { actorId: uid('u:fin'), actorRole: 'finance', action: 'payment.approve', entity: 'payments', entityId: uid('p:MAAB-2026-000097'), after: { status: 'approved' } },
    { actorId: uid('u:sup'), actorRole: 'supervisor', action: 'student.assign', entity: 'students', entityId: uid('s6'), after: { teacher: 'مزاهر عبدالرحيم' } },
  ]);
}

async function main() {
  const db = getDb();
  await db.transaction(async (tx) => {
    await seedReference(tx);
    console.log('✓ البيانات المرجعية');
    if (withDemo) {
      await seedDemo(tx);
      console.log('✓ بيانات العرض');
    }
  });
  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
