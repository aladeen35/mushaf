/*
 * بيانات العرض — أسماء وأرقام وهمية تماماً لتجربة الواجهة قبل ربط Supabase.
 * كل الأوقات هنا بتوقيت الرياض وتُحوَّل إلى UTC بالدالة riyadh().
 * ساعة العرض ثابتة (الأحد 4 أكتوبر 2026، 1:30 م) لتبقى الشاشات متّسقة.
 */
import type { PlanId, Duration } from '../domain/billing';
import type { Currency, PaymentMethod } from '../domain/market';
import type {
  AppNotification,
  Payment,
  PaymentAccount,
  Report,
  Session,
  Student,
  Teacher,
  TeacherApplication,
} from '../types';

/** «2026-10-04», «17:00» بتوقيت الرياض ← ISO بتوقيت UTC */
export function riyadh(date: string, time = '00:00'): string {
  return new Date(`${date}T${time}:00+03:00`).toISOString();
}

export const DEMO_NOW = new Date(riyadh('2026-10-04', '13:30'));

export const ACADEMY = { name: 'أكاديمية مآب لتحفيظ القرآن الكريم' };

/**
 * حسابات الاستلام لكل طريقة دفع — بيانات تجريبية، والحقيقية تضيفها المالية
 * من لوحة الإدارة. كلها تحويل يدوي برقم مرجعي ثم رفع الإيصال.
 */
export const PAYMENT_ACCOUNTS: PaymentAccount[] = [
  {
    method: 'bank_transfer_sa',
    currency: 'SAR',
    title: 'تحويل بنكي سعودي',
    bankName: 'مصرف الراجحي',
    accountName: 'أكاديمية مآب لتحفيظ القرآن الكريم',
    accountNumber: 'SA12 3456 7890 1234 5678 9012',
    instructions: 'اكتبي الرقم المرجعي في خانة الملاحظات عند التحويل.',
  },
  {
    method: 'sudan_transfer',
    currency: 'SDG',
    title: 'بنكك أو بنك سوداني',
    bankName: 'بنك الخرطوم — بنكك',
    accountName: 'أكاديمية مآب',
    accountNumber: '1234567',
    instructions: 'حوّلي من تطبيق بنكك أو أي بنك سوداني، واكتبي الرقم المرجعي في التعليق، ثم ارفعي لقطة الإشعار.',
  },
  {
    method: 'international_transfer',
    currency: 'USD',
    title: 'تحويل دولي',
    bankName: 'حساب الأكاديمية الدولي',
    accountName: 'Maab Academy',
    accountNumber: 'AE07 0331 2345 6789 0123 456',
    instructions: 'حوالة بنكية أو عبر شركة تحويل بالدولار، والرسوم على المحوِّل. اكتبي الرقم المرجعي في سبب التحويل.',
  },
];

/**
 * أسعار تجريبية لكل عملة — الأسعار الفعلية تحدّدها الإدارة من لوحة التحكم
 * لكل باقة ومدة وعملة (السعودية بالريال، والسودان بالجنيه، والبقية بالدولار).
 */
export const PRICES: Record<Currency, Record<PlanId, Record<Duration, number>>> = {
  SAR: {
    basic: { 30: 180, 45: 240, 60: 300 },
    regular: { 30: 340, 45: 460, 60: 580 },
    intensive: { 30: 480, 45: 650, 60: 820 },
  },
  SDG: {
    basic: { 30: 27_000, 45: 36_000, 60: 45_000 },
    regular: { 30: 51_000, 45: 69_000, 60: 87_000 },
    intensive: { 30: 72_000, 45: 97_500, 60: 123_000 },
  },
  USD: {
    basic: { 30: 48, 45: 64, 60: 80 },
    regular: { 30: 91, 45: 123, 60: 155 },
    intensive: { 30: 128, 45: 173, 60: 219 },
  },
};

export const teachers: Teacher[] = [
  {
    id: 't1',
    name: 'أ. مزاهر عبدالرحيم',
    headline: 'مجازة برواية حفص عن عاصم · 9 سنوات في التحفيظ',
    riwayah: 'حفص عن عاصم',
    rating: 4.9,
    categories: ['children', 'women'],
    studentsCount: 14,
  },
  {
    id: 't2',
    name: 'أ. هبة الأمين',
    headline: 'حافظة ومعلمة تجويد للأطفال · 6 سنوات',
    riwayah: 'حفص عن عاصم',
    rating: 4.8,
    categories: ['children'],
    studentsCount: 11,
  },
  {
    id: 't3',
    name: 'أ. أسماء النور',
    headline: 'إجازة في الشاطبية · تحفيظ النساء',
    riwayah: 'حفص وشعبة',
    rating: 4.9,
    categories: ['women'],
    studentsCount: 9,
  },
];

export const guardian = {
  id: 'g1',
  name: 'سلمى عثمان',
  role: 'ولية أمر',
  city: 'الرياض',
  country: 'SA' as const,
  timezone: 'Asia/Riyadh',
  currency: 'SAR' as Currency,
  phone: '+966512345678',
  email: 'salma@example.com',
};

export const students: Student[] = [
  {
    id: 's1',
    name: 'رؤى',
    fullName: 'رؤى عمر الطيب',
    gender: 'female',
    birthDate: '2017-03-12',
    guardianId: 'g1',
    teacherId: 't1',
    level: 'أتمّت جزء عمّ',
    goal: 'حفظ جزأي تبارك وقد سمع هذا العام',
    subscription: {
      plan: 'regular',
      duration: 45,
      total: 8,
      remaining: 4,
      startedAt: riyadh('2026-09-20'),
      expiresAt: riyadh('2026-10-20'),
      days: ['الأحد', 'الثلاثاء'],
      time: '5:00 م',
    },
    plan: { direction: 'nas_to_baqarah', weeklyTarget: 40, newRatio: 60 },
    memorized: [
      { from: { surah: 78, ayah: 1 }, to: { surah: 114, ayah: 6 } },
      { from: { surah: 74, ayah: 1 }, to: { surah: 74, ayah: 31 } },
      { from: { surah: 75, ayah: 1 }, to: { surah: 77, ayah: 50 } },
    ],
    current: { from: { surah: 74, ayah: 32 }, to: { surah: 74, ayah: 56 } },
  },
  {
    id: 's2',
    name: 'محمد',
    fullName: 'محمد عمر الطيب',
    gender: 'male',
    birthDate: '2019-05-02',
    guardianId: 'g1',
    teacherId: 't2',
    level: 'في جزء عمّ',
    goal: 'إتمام جزء عمّ مع أحكام النون الساكنة',
    subscription: {
      plan: 'basic',
      duration: 30,
      total: 4,
      remaining: 1,
      startedAt: riyadh('2026-09-14'),
      expiresAt: riyadh('2026-10-14'),
      days: ['الخميس'],
      time: '4:30 م',
    },
    plan: { direction: 'nas_to_baqarah', weeklyTarget: 12, newRatio: 70 },
    memorized: [
      { from: { surah: 99, ayah: 1 }, to: { surah: 114, ayah: 6 } },
      { from: { surah: 98, ayah: 1 }, to: { surah: 98, ayah: 5 } },
    ],
    current: { from: { surah: 98, ayah: 6 }, to: { surah: 98, ayah: 8 } },
  },
];

/** طلاب المعلمة مزاهر خارج أسرة ولية الأمر — لشاشات المعلمة */
export const teacherRoster = [
  { id: 's1', name: 'رؤى عمر الطيب', category: 'طفلة · 9 سنوات', current: 'المدثر 32–56', page: 576, mastery: 94, nextAt: riyadh('2026-10-04', '17:00') },
  { id: 's3', name: 'ملاذ حسن', category: 'طالبة بالغة · الخرطوم', current: 'آل عمران 92–120', page: 62, mastery: 88, nextAt: riyadh('2026-10-04', '13:35') },
  { id: 's4', name: 'تسنيم إبراهيم', category: 'طفلة · 8 سنوات', current: 'الفجر 1–14', page: 593, mastery: 81, nextAt: riyadh('2026-10-04', '15:00') },
  { id: 's5', name: 'إسراء الفاتح', category: 'طالبة بالغة · دبي', current: 'الكهف 1–16', page: 293, mastery: 96, nextAt: riyadh('2026-10-04', '19:30') },
  { id: 's6', name: 'آلاء المهدي', category: 'طفلة · 10 سنوات', current: 'الملك 1–15', page: 562, mastery: 73, nextAt: riyadh('2026-10-06', '16:00') },
  { id: 's7', name: 'هديل صالح', category: 'طفلة · 7 سنوات', current: 'الضحى – الشرح', page: 596, mastery: 90, nextAt: riyadh('2026-10-05', '17:30') },
];

export const sessions: Session[] = [
  // رؤى — الأحد والثلاثاء 5:00 م، 45 دقيقة
  { id: 'x20', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-20', '17:00'), durationMin: 45, status: 'completed', reportId: 'r0' },
  { id: 'x22', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-22', '17:00'), durationMin: 45, status: 'completed', reportId: 'r3' },
  { id: 'x27', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-27', '17:00'), durationMin: 45, status: 'completed', reportId: 'r2' },
  { id: 'x29', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-29', '17:00'), durationMin: 45, status: 'completed', reportId: 'r1' },
  { id: 'x04', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-04', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x06', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-06', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x11', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-11', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x13', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-13', '17:00'), durationMin: 45, status: 'scheduled' },
  // محمد — الخميس 4:30 م، 30 دقيقة
  { id: 'y24', studentId: 's2', teacherId: 't2', startsAt: riyadh('2026-09-24', '16:30'), durationMin: 30, status: 'student_absent' },
  { id: 'y01', studentId: 's2', teacherId: 't2', startsAt: riyadh('2026-10-01', '16:30'), durationMin: 30, status: 'completed', reportId: 'r4' },
  {
    id: 'y08',
    studentId: 's2',
    teacherId: 't2',
    startsAt: riyadh('2026-10-08', '16:30'),
    durationMin: 30,
    status: 'scheduled',
    reschedule: { proposedAt: riyadh('2026-10-07', '17:00'), by: 'teacher', reason: 'موعد طبي للمعلمة يوم الخميس' },
  },
];

export const reports: Report[] = [
  {
    id: 'r1',
    sessionId: 'x29',
    studentId: 's1',
    teacherId: 't1',
    attendance: 'present',
    segments: [
      { type: 'new', from: { surah: 74, ayah: 1 }, to: { surah: 74, ayah: 31 }, mistakes: { hifz: 1, tajweed: 2, tashkeel: 0, hesitation: 2 } },
      { type: 'near_review', from: { surah: 75, ayah: 1 }, to: { surah: 75, ayah: 40 }, mistakes: { hifz: 0, tajweed: 1, tashkeel: 1, hesitation: 1 } },
      { type: 'far_review', from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 40 }, mistakes: { hifz: 2, tajweed: 1, tashkeel: 0, hesitation: 0 } },
    ],
    grade: 'excellent',
    guardianNote: 'حفظ متقن لمطلع المدثر، مع الانتباه لمدّ الصلة في الآيات 18–20. ما شاء الله تبارك الله.',
    internalNote: 'تحتاج تثبيت المتشابهات بين المدثر والقيامة.',
    homework: [
      { type: 'new', from: { surah: 74, ayah: 32 }, to: { surah: 74, ayah: 56 } },
      { type: 'near_review', from: { surah: 76, ayah: 1 }, to: { surah: 76, ayah: 31 } },
    ],
    writtenAt: riyadh('2026-09-29', '18:02'),
  },
  {
    id: 'r2',
    sessionId: 'x27',
    studentId: 's1',
    teacherId: 't1',
    attendance: 'present',
    segments: [
      { type: 'new', from: { surah: 75, ayah: 1 }, to: { surah: 75, ayah: 40 }, mistakes: { hifz: 2, tajweed: 1, tashkeel: 1, hesitation: 2 } },
      { type: 'near_review', from: { surah: 76, ayah: 1 }, to: { surah: 76, ayah: 31 }, mistakes: { hifz: 1, tajweed: 0, tashkeel: 0, hesitation: 1 } },
    ],
    grade: 'very_good',
    guardianNote: 'حفظت سورة القيامة كاملة في حصة واحدة، تحتاج مراجعة يومية قصيرة.',
    homework: [{ type: 'new', from: { surah: 74, ayah: 1 }, to: { surah: 74, ayah: 31 } }],
    writtenAt: riyadh('2026-09-27', '17:58'),
  },
  {
    id: 'r3',
    sessionId: 'x22',
    studentId: 's1',
    teacherId: 't1',
    attendance: 'late',
    segments: [
      { type: 'new', from: { surah: 76, ayah: 19 }, to: { surah: 76, ayah: 31 }, mistakes: { hifz: 3, tajweed: 2, tashkeel: 1, hesitation: 3 } },
      { type: 'far_review', from: { surah: 80, ayah: 1 }, to: { surah: 80, ayah: 42 }, mistakes: { hifz: 1, tajweed: 1, tashkeel: 0, hesitation: 1 } },
    ],
    grade: 'very_good',
    guardianNote: 'تأخّرت رؤى 8 دقائق عن الحصة، والحفظ جيد جدًا.',
    homework: [{ type: 'new', from: { surah: 75, ayah: 1 }, to: { surah: 75, ayah: 40 } }],
    writtenAt: riyadh('2026-09-22', '18:10'),
  },
  {
    id: 'r0',
    sessionId: 'x20',
    studentId: 's1',
    teacherId: 't1',
    attendance: 'present',
    segments: [
      { type: 'new', from: { surah: 76, ayah: 1 }, to: { surah: 76, ayah: 18 }, mistakes: { hifz: 1, tajweed: 1, tashkeel: 0, hesitation: 1 } },
    ],
    grade: 'excellent',
    guardianNote: 'بداية موفّقة لسورة الإنسان.',
    homework: [{ type: 'new', from: { surah: 76, ayah: 19 }, to: { surah: 76, ayah: 31 } }],
    writtenAt: riyadh('2026-09-20', '17:55'),
  },
  {
    id: 'r4',
    sessionId: 'y01',
    studentId: 's2',
    teacherId: 't2',
    attendance: 'present',
    segments: [
      { type: 'new', from: { surah: 98, ayah: 1 }, to: { surah: 98, ayah: 5 }, mistakes: { hifz: 3, tajweed: 2, tashkeel: 1, hesitation: 2 } },
      { type: 'near_review', from: { surah: 99, ayah: 1 }, to: { surah: 99, ayah: 8 }, mistakes: { hifz: 0, tajweed: 1, tashkeel: 0, hesitation: 1 } },
    ],
    grade: 'very_good',
    guardianNote: 'تحسّن واضح في مخارج الحروف، ويحتاج تكرار الآية الخامسة من البيّنة.',
    homework: [
      { type: 'new', from: { surah: 98, ayah: 6 }, to: { surah: 98, ayah: 8 } },
      { type: 'near_review', from: { surah: 98, ayah: 1 }, to: { surah: 98, ayah: 5 } },
    ],
    writtenAt: riyadh('2026-10-01', '17:20'),
  },
];

export const payments: Payment[] = [
  {
    ref: 'MAAB-2026-000148',
    studentId: 's2',
    plan: 'basic',
    duration: 30,
    amount: 180,
    currency: 'SAR',
    method: 'bank_transfer_sa',
    status: 'under_review',
    createdAt: riyadh('2026-10-03', '20:05'),
    receipt: { fileName: 'receipt-oct.pdf', senderName: 'سلمى عثمان الحسن', transferDate: '2026-10-03', uploadedAt: riyadh('2026-10-03', '20:12') },
  },
  {
    ref: 'MAAB-2026-000097',
    studentId: 's1',
    plan: 'regular',
    duration: 45,
    amount: 460,
    currency: 'SAR',
    method: 'bank_transfer_sa',
    status: 'approved',
    createdAt: riyadh('2026-09-18', '21:40'),
    receipt: { fileName: 'IMG_2291.jpg', senderName: 'سلمى عثمان الحسن', transferDate: '2026-09-18', uploadedAt: riyadh('2026-09-18', '21:46') },
  },
  {
    ref: 'MAAB-2026-000085',
    studentId: 's2',
    plan: 'basic',
    duration: 30,
    amount: 180,
    currency: 'SAR',
    method: 'bank_transfer_sa',
    status: 'approved',
    createdAt: riyadh('2026-09-12', '19:15'),
    receipt: { fileName: 'transfer.png', senderName: 'سلمى عثمان الحسن', transferDate: '2026-09-12', uploadedAt: riyadh('2026-09-12', '19:20') },
  },
];

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'reschedule',
    title: 'طلب إعادة جدولة',
    body: 'تطلب أ. هبة الأمين نقل حصة محمد من الخميس 4:30 م إلى الأربعاء 5:00 م.',
    at: riyadh('2026-10-04', '12:10'),
    read: false,
    actionable: true,
  },
  {
    id: 'n2',
    kind: 'reminder',
    title: 'تذكير بالحصة',
    body: 'حصة رؤى مع أ. مزاهر عبدالرحيم اليوم 5:00 م. يظهر زر الدخول قبل الموعد بعشر دقائق.',
    at: riyadh('2026-10-04', '11:00'),
    read: false,
    href: '/guardian/schedule',
  },
  {
    id: 'n3',
    kind: 'balance',
    title: 'رصيد الباقة منخفض',
    body: 'بقيت حصة واحدة في باقة محمد، وتنتهي صلاحيتها 14 أكتوبر.',
    at: riyadh('2026-10-03', '19:00'),
    read: false,
    href: '/guardian/plans',
  },
  {
    id: 'n4',
    kind: 'payment',
    title: 'استلمنا إيصال التحويل',
    body: 'الطلب MAAB-2026-000148 بانتظار مراجعة المالية، ويُفعَّل فور الاعتماد.',
    at: riyadh('2026-10-03', '20:12'),
    read: true,
    href: '/guardian/payments/MAAB-2026-000148',
  },
  {
    id: 'n5',
    kind: 'report',
    title: 'تقرير الحفظ جاهز',
    body: 'محمد: البيّنة 1–5، تقدير جيد جدًا.',
    at: riyadh('2026-10-01', '17:20'),
    read: true,
    href: '/guardian/reports/r4',
  },
  {
    id: 'n6',
    kind: 'report',
    title: 'تقرير الحفظ جاهز',
    body: 'رؤى: المدثر 1–31، تقدير ممتاز.',
    at: riyadh('2026-09-29', '18:02'),
    read: true,
    href: '/guardian/reports/r1',
  },
];

/** حصص المعلمة مزاهر اليوم */
export const teacherToday = [
  { id: 'ts1', student: 'ملاذ حسن', category: 'طالبة بالغة · الخرطوم', startsAt: riyadh('2026-10-04', '13:35'), durationMin: 45, focus: 'حفظ جديد: آل عمران 92–120' },
  { id: 'ts2', student: 'تسنيم إبراهيم', category: 'طفلة · 8 سنوات', startsAt: riyadh('2026-10-04', '15:00'), durationMin: 30, focus: 'مراجعة: الفجر 1–14' },
  { id: 'x04', student: 'رؤى عمر الطيب', category: 'طفلة · 9 سنوات', startsAt: riyadh('2026-10-04', '17:00'), durationMin: 45, focus: 'حفظ جديد: المدثر 32–56' },
  { id: 'ts4', student: 'إسراء الفاتح', category: 'طالبة بالغة · دبي', startsAt: riyadh('2026-10-04', '19:30'), durationMin: 60, focus: 'تسميع: الكهف 1–16' },
];

/** حصص بلا تقرير بعد — المهلة 12 ساعة من نهاية الحصة */
export const teacherPendingReports = [
  { sessionId: 'ts0', student: 'هديل صالح', startsAt: riyadh('2026-10-04', '09:00'), durationMin: 45 },
  { sessionId: 'tsy', student: 'آلاء المهدي', startsAt: riyadh('2026-10-03', '20:30'), durationMin: 30 },
];

export const adminQueue = {
  payments: 6,
  applications: 3,
  reschedules: 2,
  unassigned: 1,
  lateReports: 2,
};

export const adminKpis = {
  activeStudents: 312,
  teachers: 27,
  activeSubscriptions: 268,
  endingThisWeek: 14,
  /** إيرادات الشهر المعتمدة بكل عملة — لا تُجمع العملات في رقم واحد */
  revenueMonth: { SAR: 64_200, SDG: 1_854_000, USD: 2_140 } as Record<Currency, number>,
  attendance: 93,
};

type PendingPayment = {
  ref: string;
  payer: string;
  country: string;
  student: string;
  plan: PlanId;
  duration: Duration;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  uploadedAt: string;
  file: string;
  senderName: string;
};

export const pendingPayments: PendingPayment[] = [
  { ref: 'MAAB-2026-000148', payer: 'سلمى عثمان', country: 'SA', student: 'محمد', plan: 'basic', duration: 30, amount: 180, currency: 'SAR', method: 'bank_transfer_sa', uploadedAt: riyadh('2026-10-03', '20:12'), file: 'receipt-oct.pdf', senderName: 'سلمى عثمان الحسن' },
  { ref: 'MAAB-2026-000150', payer: 'ملاذ حسن', country: 'SD', student: 'ملاذ حسن', plan: 'intensive', duration: 45, amount: 97_500, currency: 'SDG', method: 'sudan_transfer', uploadedAt: riyadh('2026-10-04', '08:41'), file: 'bankak-0410.jpg', senderName: 'ملاذ حسن أحمد' },
  { ref: 'MAAB-2026-000151', payer: 'ابتهال المهدي', country: 'AE', student: 'آلاء المهدي', plan: 'regular', duration: 30, amount: 91, currency: 'USD', method: 'international_transfer', uploadedAt: riyadh('2026-10-04', '10:05'), file: 'wire-aala.pdf', senderName: 'Ibtihal Elmahdi' },
  { ref: 'MAAB-2026-000146', payer: 'نعمات إبراهيم', country: 'SA', student: 'تسنيم إبراهيم', plan: 'regular', duration: 30, amount: 340, currency: 'SAR', method: 'bank_transfer_sa', uploadedAt: riyadh('2026-10-02', '22:30'), file: 'IMG_0912.png', senderName: 'نعمات إبراهيم علي' },
  { ref: 'MAAB-2026-000152', payer: 'إسراء الفاتح', country: 'AE', student: 'إسراء الفاتح', plan: 'basic', duration: 60, amount: 80, currency: 'USD', method: 'international_transfer', uploadedAt: riyadh('2026-10-04', '11:52'), file: 'receipt.pdf', senderName: 'Israa Elfatih' },
  { ref: 'MAAB-2026-000149', payer: 'عفاف صالح', country: 'SD', student: 'هديل صالح', plan: 'regular', duration: 45, amount: 69_000, currency: 'SDG', method: 'sudan_transfer', uploadedAt: riyadh('2026-10-03', '23:18'), file: 'IMG_7781.jpg', senderName: 'عفاف صالح محمد' },
];

export const applications: TeacherApplication[] = [
  { id: 'a1', name: 'فاطمة الزين', city: 'الخرطوم', riwayah: 'حفص عن عاصم', experienceYears: 5, submittedAt: riyadh('2026-10-03', '09:20'), status: 'new' },
  { id: 'a2', name: 'عائشة الطاهر', city: 'أم درمان', riwayah: 'حفص عن عاصم', experienceYears: 3, submittedAt: riyadh('2026-10-02', '14:05'), status: 'new' },
  { id: 'a3', name: 'نهى البشير', city: 'ود مدني', riwayah: 'حفص عن عاصم', experienceYears: 8, submittedAt: riyadh('2026-09-30', '11:40'), status: 'under_review' },
  { id: 'a4', name: 'منى الخضر', city: 'جدة', riwayah: 'حفص عن عاصم', experienceYears: 4, submittedAt: riyadh('2026-09-28', '16:10'), status: 'needs_info', missing: 'صورة الإجازة غير واضحة' },
  { id: 'a5', name: 'رحاب عبدالله', city: 'بورتسودان', riwayah: 'حفص عن عاصم', experienceYears: 6, submittedAt: riyadh('2026-09-25', '10:00'), status: 'interview', interviewAt: riyadh('2026-10-05', '11:00') },
  { id: 'a6', name: 'شيماء الأمين', city: 'الرياض', riwayah: 'حفص عن عاصم', experienceYears: 2, submittedAt: riyadh('2026-09-21', '13:30'), status: 'accepted' },
  { id: 'a7', name: 'سارة عوض', city: 'دبي', riwayah: 'حفص عن عاصم', experienceYears: 1, submittedAt: riyadh('2026-09-19', '19:45'), status: 'rejected' },
];

/** الآيات المحفوظة حفظاً جديداً كل شهر — لمخطط «كمية الحفظ» */
const MONTHS = ['أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'];
export const monthlyAyahs: Record<string, { month: string; value: number }[]> = {
  s1: [42, 48, 62, 55, 80, 126].map((value, i) => ({ month: MONTHS[i], value })),
  s2: [8, 10, 12, 9, 14, 16].map((value, i) => ({ month: MONTHS[i], value })),
};
