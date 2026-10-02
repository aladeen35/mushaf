/*
 * مخطط قاعدة البيانات (القسم 13): سبع مجموعات، وكل جدول بمعرّف UUID
 * وcreated_at وupdated_at، والحذف الناعم بـdeleted_at في الجداول التي تمسّ
 * بيانات المستخدم. أُضيف للسوق الدولي: الدولة والعملة والمنطقة الزمنية
 * للمستخدم، وحسابات الاستلام لكل طريقة دفع، وتحديات رمز الدخول.
 *
 * القيود الحرجة (EXCLUDE، المشغّلات، عدم قابلية التعديل) وسياسات RLS
 * في ملفات الترحيل اليدوية drizzle/*_security.sql لأنها أوضح بـSQL مباشرة.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  char,
  check,
  date,
  index,
  inet,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid().primaryKey().defaultRandom();
const ts = () => timestamp({ withTimezone: true });
const timestamps = {
  createdAt: ts().notNull().defaultNow(),
  updatedAt: ts().notNull().defaultNow(),
};
const softDelete = { deletedAt: ts() };

// ——— التعدادات ———

export const roleKey = pgEnum('role_key', [
  'guardian',
  'adult_student',
  'minor_student',
  'teacher',
  'supervisor',
  'finance',
  'support',
  'super_admin',
]);
export const gender = pgEnum('gender', ['female', 'male']);
export const currency = pgEnum('currency', ['SAR', 'SDG', 'USD']);
export const consentKind = pgEnum('consent_kind', ['terms', 'privacy', 'minor_data', 'no_recording']);
export const otpChannel = pgEnum('otp_channel', ['whatsapp', 'sms', 'email']);
export const teacherStatus = pgEnum('teacher_status', ['active', 'suspended', 'inactive']);
export const teacherCategory = pgEnum('teacher_category', ['children', 'women']);
export const applicationStatus = pgEnum('application_status', [
  'new',
  'under_review',
  'needs_info',
  'interview',
  'accepted',
  'rejected',
]);
export const orderStatus = pgEnum('order_status', ['pending_payment', 'paid', 'cancelled', 'expired']);
export const paymentMethod = pgEnum('payment_method', [
  'bank_transfer_sa',
  'sudan_transfer',
  'international_transfer',
  'mada',
  'card',
  'apple_pay',
  'stc_pay',
]);
export const paymentStatus = pgEnum('payment_status', [
  'awaiting_transfer',
  'under_review',
  'approved',
  'rejected',
  'needs_fix',
  'expired',
]);
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'expired', 'cancelled']);
export const sessionStatus = pgEnum('session_status', [
  /** محجوزة مؤقتاً حتى يُعتمد الدفع (72 ساعة) — تمنع التعارض كالمجدولة */
  'held',
  'scheduled',
  'completed',
  'student_absent',
  'teacher_absent',
  'excused',
  'technical_issue',
  'cancelled',
]);
export const attendanceStatus = pgEnum('attendance_status', ['present', 'late', 'absent', 'teacher_absent']);
export const rescheduleStatus = pgEnum('reschedule_status', ['pending', 'accepted', 'rejected', 'cancelled']);
export const segmentType = pgEnum('segment_type', ['new', 'near_review', 'far_review', 'recitation', 'test']);
export const mistakeKind = pgEnum('mistake_kind', ['hifz', 'tajweed', 'tashkeel', 'hesitation']);
export const grade = pgEnum('grade', ['excellent', 'very_good', 'good', 'needs_repeat']);
export const planDirection = pgEnum('plan_direction', ['nas_to_baqarah', 'baqarah_to_nas']);
export const notificationChannel = pgEnum('notification_channel', ['in_app', 'push', 'email', 'sms', 'whatsapp']);
export const notificationStatus = pgEnum('notification_status', ['queued', 'sent', 'failed', 'read']);
export const fileKind = pgEnum('file_kind', ['id_document', 'ijazah', 'certificate', 'recording', 'receipt', 'avatar']);
export const meetingStatus = pgEnum('meeting_status', ['pending', 'created', 'failed']);
export const jobStatus = pgEnum('job_status', ['queued', 'running', 'done', 'failed']);

// ═══ 1. الهوية والصلاحيات ═══

export const users = pgTable(
  'users',
  {
    id: id(),
    /** E.164 — المعرّف الأساسي للدخول، أو البريد لمن يدخل به */
    phone: text(),
    email: text(),
    fullName: text().notNull().default(''),
    country: char({ length: 2 }).notNull().default('SA'),
    city: text(),
    timezone: text().notNull().default('Asia/Riyadh'),
    currency: currency().notNull().default('SAR'),
    locale: text().notNull().default('ar'),
    googleSub: text(),
    /** حساب فرعي لطالب قاصر يدخل برمز من ولي أمره، بلا جوال ولا بريد */
    studentLogin: boolean().notNull().default(false),
    avatarFileId: uuid(),
    /** تفضيلات الإشعار لكل حدث وقناة: {"session_reminder_24h": {"whatsapp": false}} */
    notificationPrefs: jsonb().$type<Record<string, Partial<Record<'whatsapp' | 'email' | 'sms' | 'push', boolean>>>>().notNull().default({}),
    lastLoginAt: ts(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('users_phone_uq').on(t.phone).where(sql`${t.deletedAt} is null`),
    uniqueIndex('users_email_uq').on(sql`lower(${t.email})`).where(sql`${t.deletedAt} is null`),
    uniqueIndex('users_google_uq').on(t.googleSub),
    check(
      'users_identifier_ck',
      sql`${t.phone} is not null or ${t.email} is not null or ${t.googleSub} is not null or ${t.studentLogin}`,
    ),
    check('users_phone_e164_ck', sql`${t.phone} is null or ${t.phone} ~ '^\\+[1-9][0-9]{6,14}$'`),
  ],
);

export const roles = pgTable('roles', {
  key: roleKey().primaryKey(),
  nameAr: text().notNull(),
  description: text(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleKey()
      .notNull()
      .references(() => roles.key),
    grantedBy: uuid().references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const permissions = pgTable('permissions', {
  key: text().primaryKey(),
  description: text().notNull(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    role: roleKey()
      .notNull()
      .references(() => roles.key),
    permission: text()
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

export const guardians = pgTable('guardians', {
  id: id(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  ...timestamps,
  ...softDelete,
});

export const teachers = pgTable(
  'teachers',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text().notNull(),
    headline: text(),
    riwayah: text().notNull().default('حفص عن عاصم'),
    categories: teacherCategory().array().notNull().default(sql`'{children}'`),
    levels: text().array().notNull().default(sql`'{}'`),
    maxStudents: smallint().notNull().default(20),
    timezone: text().notNull().default('Asia/Riyadh'),
    status: teacherStatus().notNull().default('active'),
    applicationId: uuid(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [check('teachers_max_students_ck', sql`${t.maxStudents} between 1 and 200`)],
);

export const students = pgTable(
  'students',
  {
    id: id(),
    /** الطالبة البالغة أو القاصر الذي له دخول فرعي */
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    fullName: text().notNull(),
    displayName: text().notNull(),
    gender: gender().notNull(),
    birthDate: date().notNull(),
    level: text(),
    goal: text(),
    teacherId: uuid().references(() => teachers.id, { onDelete: 'set null' }),
    /** رمز دخول القاصر (ستة أحرف) مخزّن مجزّأً لا نصاً */
    loginCodeHash: text(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('students_teacher_idx').on(t.teacherId),
    uniqueIndex('students_login_code_uq').on(t.loginCodeHash),
    check('students_birth_ck', sql`${t.birthDate} > '1920-01-01'`),
  ],
);

export const guardianStudents = pgTable(
  'guardian_students',
  {
    guardianId: uuid()
      .notNull()
      .references(() => guardians.id, { onDelete: 'cascade' }),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** parent: ولي أمر لطفله، self: الطالبة البالغة ولية أمر نفسها */
    relation: text().notNull().default('parent'),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guardianId, t.studentId] }), index('guardian_students_student_idx').on(t.studentId)],
);

export const consents = pgTable(
  'consents',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid().references(() => students.id, { onDelete: 'cascade' }),
    kind: consentKind().notNull(),
    version: text().notNull(),
    ip: inet(),
    userAgent: text(),
    acceptedAt: ts().notNull().defaultNow(),
  },
  (t) => [index('consents_user_idx').on(t.userId)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    identifier: text().notNull(),
    channel: text().notNull(),
    success: boolean().notNull(),
    reason: text(),
    ip: inet(),
    userAgent: text(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('login_attempts_identifier_idx').on(t.identifier, t.createdAt)],
);

/** تحدّي رمز الدخول — صالح 5 دقائق، و5 محاولات ثم قفل 15 دقيقة (القسم 15) */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: id(),
    identifier: text().notNull(),
    channel: otpChannel().notNull(),
    codeHash: text().notNull(),
    attempts: smallint().notNull().default(0),
    expiresAt: ts().notNull(),
    lockedUntil: ts(),
    consumedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('otp_identifier_idx').on(t.identifier, t.createdAt)],
);

// ═══ 2. المعلمات ═══

export const files = pgTable(
  'files',
  {
    id: id(),
    ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
    kind: fileKind().notNull(),
    bucket: text().notNull(),
    path: text().notNull(),
    mime: text().notNull(),
    sizeBytes: integer().notNull(),
    sha256: text().notNull(),
    createdAt: ts().notNull().defaultNow(),
    ...softDelete,
  },
  (t) => [
    uniqueIndex('files_bucket_path_uq').on(t.bucket, t.path),
    // الأنواع والأحجام المسموحة: مستندات وإيصالات حتى 5MB، والصوت حتى 10MB
    check(
      'files_mime_ck',
      sql`(${t.kind} = 'recording' and ${t.mime} in ('audio/mpeg','audio/mp4','audio/x-m4a') and ${t.sizeBytes} <= 10485760)
       or (${t.kind} <> 'recording' and ${t.mime} in ('application/pdf','image/jpeg','image/png') and ${t.sizeBytes} <= 5242880)`,
    ),
  ],
);

export const teacherApplications = pgTable(
  'teacher_applications',
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    fullName: text().notNull(),
    phone: text().notNull(),
    email: text(),
    country: char({ length: 2 }).notNull().default('SA'),
    city: text(),
    ijazah: text().notNull(),
    experience: text().notNull(),
    categories: teacherCategory().array().notNull(),
    status: applicationStatus().notNull().default('new'),
    missingInfo: text(),
    interviewAt: ts(),
    rejectionReason: text(),
    reviewedBy: uuid().references(() => users.id),
    decidedAt: ts(),
    reapplyAfter: date(),
    // الفئات وحدّ الطالبات ومستواهن تحددها الإدارة بعد القبول
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    index('teacher_applications_status_idx').on(t.status, t.createdAt),
    check('teacher_applications_reject_reason_ck', sql`${t.status} <> 'rejected' or ${t.rejectionReason} is not null`),
  ],
);

export const teacherDocuments = pgTable('teacher_documents', {
  id: id(),
  applicationId: uuid()
    .notNull()
    .references(() => teacherApplications.id, { onDelete: 'cascade' }),
  kind: fileKind().notNull(),
  fileId: uuid()
    .notNull()
    .references(() => files.id),
  createdAt: ts().notNull().defaultNow(),
});

/** فترات الإتاحة الأسبوعية بالتوقيت المحلي للمعلمة */
export const teacherAvailability = pgTable(
  'teacher_availability',
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    ...timestamps,
  },
  (t) => [
    index('teacher_availability_teacher_idx').on(t.teacherId, t.weekday),
    check('teacher_availability_weekday_ck', sql`${t.weekday} between 0 and 6`),
    check('teacher_availability_range_ck', sql`${t.endTime} >= ${t.startTime} + interval '30 minutes'`),
  ],
);

export const teacherTimeOff = pgTable(
  'teacher_time_off',
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    reason: text(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [check('teacher_time_off_range_ck', sql`${t.endsOn} >= ${t.startsOn}`)],
);

export const teacherRatings = pgTable(
  'teacher_ratings',
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    guardianId: uuid()
      .notNull()
      .references(() => guardians.id, { onDelete: 'cascade' }),
    month: date().notNull(),
    score: smallint().notNull(),
    comment: text(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('teacher_ratings_uq').on(t.teacherId, t.guardianId, t.month),
    check('teacher_ratings_score_ck', sql`${t.score} between 1 and 5`),
  ],
);

export const teacherDisciplineEvents = pgTable(
  'teacher_discipline_events',
  {
    id: id(),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    sessionId: uuid(),
    /** late | absent_unexcused | absent_excused | report_late */
    kind: text().notNull(),
    minutes: smallint(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('teacher_discipline_teacher_idx').on(t.teacherId, t.createdAt)],
);

// ═══ 3. الباقات والدفع ═══

export const plans = pgTable(
  'plans',
  {
    id: id(),
    code: text().notNull().unique(),
    nameAr: text().notNull(),
    sessionsCount: smallint().notNull(),
    perWeek: smallint().notNull(),
    rolloverMax: smallint().notNull(),
    validityDays: smallint().notNull().default(30),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [check('plans_counts_ck', sql`${t.sessionsCount} > 0 and ${t.perWeek} between 1 and 7 and ${t.rolloverMax} >= 0`)],
);

/** سعر كل باقة لكل مدة ولكل عملة — تحدده الإدارة من لوحة التحكم */
export const planPrices = pgTable(
  'plan_prices',
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    durationMin: smallint().notNull(),
    currency: currency().notNull(),
    amount: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('plan_prices_uq').on(t.planId, t.durationMin, t.currency).where(sql`${t.active}`),
    check('plan_prices_duration_ck', sql`${t.durationMin} in (30, 45, 60)`),
    check('plan_prices_amount_ck', sql`${t.amount} >= 0`),
  ],
);

/** حسابات الاستلام: آيبان سعودي، حساب بنكك أو بنك سوداني، حساب للتحويل الدولي */
export const paymentAccounts = pgTable('payment_accounts', {
  id: id(),
  method: paymentMethod().notNull(),
  currency: currency().notNull(),
  titleAr: text().notNull(),
  bankName: text().notNull(),
  accountName: text().notNull(),
  accountNumber: text().notNull(),
  instructionsAr: text(),
  active: boolean().notNull().default(true),
  sort: smallint().notNull().default(0),
  ...timestamps,
});

export const coupons = pgTable(
  'coupons',
  {
    id: id(),
    code: text().notNull(),
    kind: text().notNull(),
    value: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    /** للخصم الثابت: عملة المبلغ */
    currency: currency(),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    maxUses: integer(),
    maxUsesPerUser: smallint().notNull().default(1),
    planCodes: text().array(),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('coupons_code_uq').on(sql`upper(${t.code})`),
    check('coupons_kind_ck', sql`(${t.kind} = 'percent' and ${t.value} > 0 and ${t.value} <= 100) or (${t.kind} = 'fixed' and ${t.value} > 0 and ${t.currency} is not null)`),
    check('coupons_range_ck', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    /** MAAB-2026-000123 — تسلسل سنوي فريد */
    ref: text().notNull().unique(),
    guardianId: uuid()
      .notNull()
      .references(() => guardians.id),
    currency: currency().notNull(),
    subtotal: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    discount: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull().default(0),
    total: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    couponId: uuid().references(() => coupons.id),
    status: orderStatus().notNull().default('pending_payment'),
    holdExpiresAt: ts().notNull(),
    ...timestamps,
  },
  (t) => [
    index('orders_guardian_idx').on(t.guardianId, t.createdAt),
    check('orders_ref_ck', sql`${t.ref} ~ '^MAAB-[0-9]{4}-[0-9]{6}$'`),
    check('orders_total_ck', sql`${t.total} = ${t.subtotal} - ${t.discount} and ${t.total} >= 0`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    studentId: uuid()
      .notNull()
      .references(() => students.id),
    planId: uuid()
      .notNull()
      .references(() => plans.id),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id),
    durationMin: smallint().notNull(),
    unitPrice: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: id(),
    orderItemId: uuid()
      .notNull()
      .unique()
      .references(() => orderItems.id),
    studentId: uuid()
      .notNull()
      .references(() => students.id),
    planId: uuid()
      .notNull()
      .references(() => plans.id),
    durationMin: smallint().notNull(),
    sessionsTotal: smallint().notNull(),
    // الرصيد لا ينزل تحت الصفر، ويُخصم داخل المعاملة نفسها مع تغيير حالة الحصة
    sessionsRemaining: smallint().notNull(),
    rolledOver: smallint().notNull().default(0),
    startsAt: ts().notNull(),
    expiresAt: ts().notNull(),
    status: subscriptionStatus().notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('subscriptions_student_idx').on(t.studentId, t.status),
    check('subscriptions_remaining_ck', sql`${t.sessionsRemaining} >= 0 and ${t.sessionsRemaining} <= ${t.sessionsTotal} + ${t.rolledOver}`),
    check('subscriptions_range_ck', sql`${t.expiresAt} > ${t.startsAt}`),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    method: paymentMethod().notNull(),
    accountId: uuid().references(() => paymentAccounts.id),
    currency: currency().notNull(),
    amount: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    status: paymentStatus().notNull().default('awaiting_transfer'),
    reason: text(),
    reviewedBy: uuid().references(() => users.id),
    reviewedAt: ts(),
    gatewayRef: text(),
    ...timestamps,
  },
  (t) => [
    index('payments_status_idx').on(t.status, t.createdAt),
    check('payments_reason_ck', sql`${t.status} not in ('rejected', 'needs_fix') or ${t.reason} is not null`),
  ],
);

export const paymentReceipts = pgTable('payment_receipts', {
  id: id(),
  paymentId: uuid()
    .notNull()
    .references(() => payments.id),
  fileId: uuid()
    .notNull()
    .references(() => files.id),
  senderName: text().notNull(),
  transferDate: date().notNull(),
  uploadedBy: uuid()
    .notNull()
    .references(() => users.id),
  createdAt: ts().notNull().defaultNow(),
});

export const refunds = pgTable(
  'refunds',
  {
    id: id(),
    paymentId: uuid()
      .notNull()
      .references(() => payments.id),
    amount: numeric({ precision: 12, scale: 2, mode: 'number' }).notNull(),
    currency: currency().notNull(),
    reason: text().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [check('refunds_amount_ck', sql`${t.amount} > 0`)],
);

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: id(),
    couponId: uuid()
      .notNull()
      .references(() => coupons.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('coupon_redemptions_uq').on(t.couponId, t.orderId)],
);

// ═══ 4. الجدولة ═══

/** موعد متكرر أسبوعي يولّد منه النظام حصصاً فعلية لمدة الباقة */
export const recurringSlots = pgTable(
  'recurring_slots',
  {
    id: id(),
    orderItemId: uuid()
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id),
    studentId: uuid()
      .notNull()
      .references(() => students.id),
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    /** منطقة ولي الأمر عند الحجز — تُحوَّل منها المواعيد إلى UTC */
    timezone: text().notNull(),
    durationMin: smallint().notNull(),
    active: boolean().notNull().default(true),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [check('recurring_slots_weekday_ck', sql`${t.weekday} between 0 and 6`)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    subscriptionId: uuid().references(() => subscriptions.id),
    /** بند الطلب الذي حُجزت له الحصة؛ عند اعتماد الدفع تُربط باشتراكه */
    orderItemId: uuid().references(() => orderItems.id),
    studentId: uuid()
      .notNull()
      .references(() => students.id),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    /** نهاية الحصة + الفاصل الإلزامي (5 دقائق) — يضبطه مشغّل ويقوم عليه قيد EXCLUDE */
    blockedUntil: ts().notNull(),
    status: sessionStatus().notNull().default('scheduled'),
    isMakeup: boolean().notNull().default(false),
    cancelReason: text(),
    ...timestamps,
  },
  (t) => [
    index('sessions_teacher_idx').on(t.teacherId, t.startsAt),
    index('sessions_student_idx').on(t.studentId, t.startsAt),
    index('sessions_order_item_idx').on(t.orderItemId),
    check('sessions_range_ck', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const sessionAttendance = pgTable(
  'session_attendance',
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    /** student | teacher */
    side: text().notNull(),
    joinClickedAt: ts().notNull().defaultNow(),
  },
  (t) => [index('session_attendance_session_idx').on(t.sessionId)],
);

export const rescheduleRequests = pgTable('reschedule_requests', {
  id: id(),
  sessionId: uuid()
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  requestedBy: uuid()
    .notNull()
    .references(() => users.id),
  proposedStartsAt: ts().notNull(),
  reason: text().notNull(),
  status: rescheduleStatus().notNull().default('pending'),
  decidedBy: uuid().references(() => users.id),
  decidedAt: ts(),
  createdAt: ts().notNull().defaultNow(),
});

export const meetings = pgTable('meetings', {
  id: id(),
  sessionId: uuid()
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  provider: text().notNull().default('google_meet'),
  externalEventId: text(),
  joinUrl: text(),
  status: meetingStatus().notNull().default('pending'),
  attempts: smallint().notNull().default(0),
  lastError: text(),
  ...timestamps,
});

// ═══ 5. الحفظ ═══

export const quranSurahs = pgTable('quran_surahs', {
  id: smallint().primaryKey(),
  nameAr: text().notNull(),
  ayahCount: smallint().notNull(),
  place: text().notNull(),
  startPage: smallint().notNull(),
});

/** جدول ثابت للآيات الـ6236، المعرّف هو رقم الآية في المصحف كله */
export const quranAyahs = pgTable(
  'quran_ayahs',
  {
    id: smallint().primaryKey(),
    surahId: smallint()
      .notNull()
      .references(() => quranSurahs.id),
    ayahNumber: smallint().notNull(),
    juz: smallint().notNull(),
    page: smallint().notNull(),
    text: text().notNull(),
    searchKey: text().notNull(),
  },
  (t) => [uniqueIndex('quran_ayahs_ref_uq').on(t.surahId, t.ayahNumber), check('quran_ayahs_id_ck', sql`${t.id} between 1 and 6236`)],
);

export const sessionReports = pgTable(
  'session_reports',
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .unique()
      .references(() => sessions.id),
    teacherId: uuid()
      .notNull()
      .references(() => teachers.id),
    studentId: uuid()
      .notNull()
      .references(() => students.id),
    attendance: attendanceStatus().notNull(),
    grade: grade(),
    mastery: numeric({ precision: 5, scale: 2, mode: 'number' }),
    guardianNote: text(),
    late: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('session_reports_student_idx').on(t.studentId, t.createdAt),
    check('session_reports_note_ck', sql`${t.guardianNote} is null or char_length(${t.guardianNote}) <= 280`),
    check('session_reports_mastery_ck', sql`${t.mastery} is null or ${t.mastery} between 0 and 100`),
  ],
);

/** الملاحظة الداخلية في جدول مستقل: تراها المعلمة الكاتبة والمشرفة فقط، لا ولي الأمر */
export const reportInternalNotes = pgTable('report_internal_notes', {
  reportId: uuid()
    .primaryKey()
    .references(() => sessionReports.id, { onDelete: 'cascade' }),
  note: text().notNull(),
  authorId: uuid()
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const reportSegments = pgTable(
  'report_segments',
  {
    id: id(),
    reportId: uuid()
      .notNull()
      .references(() => sessionReports.id, { onDelete: 'cascade' }),
    position: smallint().notNull(),
    type: segmentType().notNull(),
    fromAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    toAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    /** مقطع الواجب للحصة القادمة لا مقطع منجز */
    homework: boolean().notNull().default(false),
    mastery: numeric({ precision: 5, scale: 2, mode: 'number' }),
    counted: boolean().notNull().default(false),
  },
  (t) => [
    index('report_segments_report_idx').on(t.reportId),
    // نطاق المقطع صالح: آية البداية قبل آية النهاية أو تساويها
    check('report_segments_range_ck', sql`${t.toAyah} >= ${t.fromAyah}`),
  ],
);

export const segmentMistakes = pgTable(
  'segment_mistakes',
  {
    id: id(),
    segmentId: uuid()
      .notNull()
      .references(() => reportSegments.id, { onDelete: 'cascade' }),
    kind: mistakeKind().notNull(),
    count: smallint().notNull(),
    ayahId: smallint().references(() => quranAyahs.id),
    note: text(),
  },
  (t) => [check('segment_mistakes_count_ck', sql`${t.count} >= 0`)],
);

export const memorizationPlans = pgTable(
  'memorization_plans',
  {
    id: id(),
    studentId: uuid()
      .notNull()
      .unique()
      .references(() => students.id, { onDelete: 'cascade' }),
    direction: planDirection().notNull().default('nas_to_baqarah'),
    startAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    weeklyTargetAyahs: smallint().notNull(),
    newRatio: smallint().notNull().default(60),
    setBy: uuid().references(() => users.id),
    ...timestamps,
  },
  (t) => [check('memorization_plans_ratio_ck', sql`${t.newRatio} between 0 and 100 and ${t.weeklyTargetAyahs} > 0`)],
);

/**
 * المحفوظ فعلاً بنطاقات الآيات: من مستوى الطالب عند التسجيل (placement)،
 * ومن مقاطع الحفظ الجديد المحتسبة في التقارير (report). منه تُبنى خريطة الأجزاء.
 */
export const memorizedRanges = pgTable(
  'memorized_ranges',
  {
    id: id(),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    fromAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    toAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    /** placement | report */
    source: text().notNull(),
    segmentId: uuid().references(() => reportSegments.id, { onDelete: 'cascade' }),
    memorizedOn: date().notNull(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [
    index('memorized_ranges_student_idx').on(t.studentId),
    check('memorized_ranges_range_ck', sql`${t.toAyah} >= ${t.fromAyah}`),
    check('memorized_ranges_source_ck', sql`${t.source} in ('placement', 'report') and (${t.source} = 'placement' or ${t.segmentId} is not null)`),
  ],
);

export const reviewSchedule = pgTable(
  'review_schedule',
  {
    id: id(),
    studentId: uuid()
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    fromAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    toAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    memorizedOn: date().notNull(),
    step: smallint().notNull().default(0),
    dueOn: date().notNull(),
    doneAt: ts(),
  },
  (t) => [
    index('review_schedule_due_idx').on(t.studentId, t.dueOn),
    check('review_schedule_range_ck', sql`${t.toAyah} >= ${t.fromAyah} and ${t.step} between 0 and 5`),
  ],
);

// ═══ 6. المحتوى ═══

export const tafsirSources = pgTable('tafsir_sources', {
  id: id(),
  key: text().notNull().unique(),
  nameAr: text().notNull(),
  sourceNote: text(),
  local: boolean().notNull().default(true),
});

export const tafsirEntries = pgTable(
  'tafsir_entries',
  {
    id: id(),
    sourceId: uuid()
      .notNull()
      .references(() => tafsirSources.id, { onDelete: 'cascade' }),
    fromAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    toAyah: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    text: text().notNull(),
  },
  (t) => [uniqueIndex('tafsir_entries_uq').on(t.sourceId, t.fromAyah)],
);

export const azkar = pgTable('azkar', {
  id: id(),
  section: text().notNull(),
  position: smallint().notNull(),
  text: text().notNull(),
  repeatCount: smallint().notNull().default(1),
  virtue: text(),
  published: boolean().notNull().default(false),
  reviewedBy: uuid().references(() => users.id),
  ...timestamps,
});

export const dailyWird = pgTable('daily_wird', {
  id: id(),
  day: date().notNull().unique(),
  fromAyah: smallint()
    .notNull()
    .references(() => quranAyahs.id),
  toAyah: smallint()
    .notNull()
    .references(() => quranAyahs.id),
  setBy: uuid().references(() => users.id),
  createdAt: ts().notNull().defaultNow(),
});

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** last_read | bookmark */
    kind: text().notNull(),
    page: smallint().notNull(),
    ayahId: smallint().references(() => quranAyahs.id),
    note: text(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('bookmarks_last_read_uq').on(t.userId).where(sql`${t.kind} = 'last_read'`),
    check('bookmarks_page_ck', sql`${t.page} between 1 and 604`),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ayahId: smallint()
      .notNull()
      .references(() => quranAyahs.id),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('favorites_uq').on(t.userId, t.ayahId)],
);

// ═══ 7. النظام ═══

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    event: text().notNull(),
    channel: notificationChannel().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>(),
    status: notificationStatus().notNull().default('queued'),
    error: text(),
    sentAt: ts(),
    readAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: id(),
    event: text().notNull(),
    channel: notificationChannel().notNull(),
    locale: text().notNull().default('ar'),
    title: text().notNull(),
    body: text().notNull(),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('notification_templates_uq').on(t.event, t.channel, t.locale)],
);

/** سجل تدقيق غير قابل للتعديل ويُحفظ 3 سنوات (القسم 15) */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    actorId: uuid(),
    actorRole: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    reason: text(),
    impersonatedUserId: uuid(),
    ip: inet(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entity, t.entityId), index('audit_logs_created_idx').on(t.createdAt)],
);

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  description: text(),
  updatedBy: uuid().references(() => users.id),
  updatedAt: ts().notNull().defaultNow(),
});

export const featureFlags = pgTable('feature_flags', {
  key: text().primaryKey(),
  enabled: boolean().notNull().default(false),
  description: text().notNull(),
  updatedBy: uuid().references(() => users.id),
  updatedAt: ts().notNull().defaultNow(),
});

/** تسلسل الرقم المرجعي السنوي للطلبات (MAAB-2026-000123) دون تعارض بين الطلبات المتزامنة */
export const refCounters = pgTable('ref_counters', {
  year: smallint().primaryKey(),
  last: integer().notNull().default(0),
});

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    name: text().notNull(),
    payload: jsonb(),
    status: jobStatus().notNull().default('queued'),
    attempts: smallint().notNull().default(0),
    lastError: text(),
    runAt: ts().notNull().defaultNow(),
    finishedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('jobs_status_idx').on(t.status, t.runAt)],
);

/**
 * مفاتيح منع التكرار (القسم 14): الحجز والدفع يقبلان Idempotency-Key، فإن
 * ضُغط الزر مرتين أعاد الخادم الاستجابة الأولى نفسها بدل إنشاء طلب ثانٍ.
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    route: text().notNull(),
    /** بصمة جسم الطلب: المفتاح نفسه بجسم مختلف يُرفض */
    requestHash: text().notNull(),
    status: smallint(),
    response: jsonb(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] }), index('idempotency_created_idx').on(t.createdAt)],
);
