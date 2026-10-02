/*
 * بيانات العرض — أسماء وأرقام وهمية تماماً لتجربة الواجهة قبل ربط Supabase.
 * كل الأوقات هنا بتوقيت الرياض وتُحوَّل إلى UTC بالدالة riyadh().
 * ساعة العرض ثابتة (الأحد 4 أكتوبر 2026، 1:30 م) لتبقى الشاشات متّسقة.
 */
import type { PlanId, Duration } from '../domain/billing';
import type {
  AppNotification,
  Payment,
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

export const ACADEMY = {
  name: 'أكاديمية مآب لتحفيظ القرآن الكريم',
  bank: {
    bankName: 'مصرف الراجحي',
    beneficiary: 'أكاديمية مآب لتحفيظ القرآن الكريم',
    iban: 'SA12 3456 7890 1234 5678 9012',
    demo: true,
  },
};

/** أسعار تجريبية — الأسعار الفعلية تحدّدها الإدارة من لوحة التحكم (سؤال مفتوح في القسم 6) */
export const PRICES: Record<PlanId, Record<Duration, number>> = {
  basic: { 30: 180, 45: 240, 60: 300 },
  regular: { 30: 340, 45: 460, 60: 580 },
  intensive: { 30: 480, 45: 650, 60: 820 },
};

export const teachers: Teacher[] = [
  {
    id: 't1',
    name: 'أ. هند القحطاني',
    headline: 'مجازة برواية حفص عن عاصم · 9 سنوات في التحفيظ',
    riwayah: 'حفص عن عاصم',
    rating: 4.9,
    categories: ['children', 'women'],
    studentsCount: 14,
  },
  {
    id: 't2',
    name: 'أ. مريم الزهراني',
    headline: 'حافظة ومعلمة تجويد للأطفال · 6 سنوات',
    riwayah: 'حفص عن عاصم',
    rating: 4.8,
    categories: ['children'],
    studentsCount: 11,
  },
  {
    id: 't3',
    name: 'أ. أسماء العتيبي',
    headline: 'إجازة في الشاطبية · تحفيظ النساء',
    riwayah: 'حفص وشعبة',
    rating: 4.9,
    categories: ['women'],
    studentsCount: 9,
  },
];

export const guardian = {
  id: 'g1',
  name: 'نورة السبيعي',
  role: 'ولية أمر',
  city: 'الرياض',
  phone: '51 234 5678',
  email: 'noura@example.com',
};

export const students: Student[] = [
  {
    id: 's1',
    name: 'ريم',
    fullName: 'ريم السبيعي',
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
    name: 'عبدالرحمن',
    fullName: 'عبدالرحمن السبيعي',
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

/** طالبات المعلمة هند خارج أسرة ولية الأمر — لشاشات المعلمة */
export const teacherRoster = [
  { id: 's1', name: 'ريم السبيعي', category: 'طفلة · 9 سنوات', current: 'المدثر 32–56', page: 576, mastery: 94, nextAt: riyadh('2026-10-04', '17:00') },
  { id: 's3', name: 'سارة المطيري', category: 'طالبة بالغة', current: 'آل عمران 92–120', page: 62, mastery: 88, nextAt: riyadh('2026-10-04', '13:35') },
  { id: 's4', name: 'لين الدوسري', category: 'طفلة · 8 سنوات', current: 'الفجر 1–14', page: 593, mastery: 81, nextAt: riyadh('2026-10-04', '15:00') },
  { id: 's5', name: 'هيا الشمري', category: 'طالبة بالغة', current: 'الكهف 1–16', page: 293, mastery: 96, nextAt: riyadh('2026-10-04', '19:30') },
  { id: 's6', name: 'جود الحربي', category: 'طفلة · 10 سنوات', current: 'الملك 1–15', page: 562, mastery: 73, nextAt: riyadh('2026-10-06', '16:00') },
  { id: 's7', name: 'ليان العنزي', category: 'طفلة · 7 سنوات', current: 'الضحى – الشرح', page: 596, mastery: 90, nextAt: riyadh('2026-10-05', '17:30') },
];

export const sessions: Session[] = [
  // ريم — الأحد والثلاثاء 5:00 م، 45 دقيقة
  { id: 'x20', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-20', '17:00'), durationMin: 45, status: 'completed', reportId: 'r0' },
  { id: 'x22', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-22', '17:00'), durationMin: 45, status: 'completed', reportId: 'r3' },
  { id: 'x27', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-27', '17:00'), durationMin: 45, status: 'completed', reportId: 'r2' },
  { id: 'x29', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-09-29', '17:00'), durationMin: 45, status: 'completed', reportId: 'r1' },
  { id: 'x04', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-04', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x06', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-06', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x11', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-11', '17:00'), durationMin: 45, status: 'scheduled' },
  { id: 'x13', studentId: 's1', teacherId: 't1', startsAt: riyadh('2026-10-13', '17:00'), durationMin: 45, status: 'scheduled' },
  // عبدالرحمن — الخميس 4:30 م، 30 دقيقة
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
    guardianNote: 'تأخّرت ريم 8 دقائق عن الحصة، والحفظ جيد جدًا.',
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
    status: 'under_review',
    createdAt: riyadh('2026-10-03', '20:05'),
    receipt: { fileName: 'receipt-oct.pdf', senderName: 'نورة محمد السبيعي', transferDate: '2026-10-03', uploadedAt: riyadh('2026-10-03', '20:12') },
  },
  {
    ref: 'MAAB-2026-000097',
    studentId: 's1',
    plan: 'regular',
    duration: 45,
    amount: 460,
    status: 'approved',
    createdAt: riyadh('2026-09-18', '21:40'),
    receipt: { fileName: 'IMG_2291.jpg', senderName: 'نورة محمد السبيعي', transferDate: '2026-09-18', uploadedAt: riyadh('2026-09-18', '21:46') },
  },
  {
    ref: 'MAAB-2026-000085',
    studentId: 's2',
    plan: 'basic',
    duration: 30,
    amount: 180,
    status: 'approved',
    createdAt: riyadh('2026-09-12', '19:15'),
    receipt: { fileName: 'transfer.png', senderName: 'نورة محمد السبيعي', transferDate: '2026-09-12', uploadedAt: riyadh('2026-09-12', '19:20') },
  },
];

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'reschedule',
    title: 'طلب إعادة جدولة',
    body: 'تطلب أ. مريم الزهراني نقل حصة عبدالرحمن من الخميس 4:30 م إلى الأربعاء 5:00 م.',
    at: riyadh('2026-10-04', '12:10'),
    read: false,
    actionable: true,
  },
  {
    id: 'n2',
    kind: 'reminder',
    title: 'تذكير بالحصة',
    body: 'حصة ريم مع أ. هند القحطاني اليوم 5:00 م. يظهر زر الدخول قبل الموعد بعشر دقائق.',
    at: riyadh('2026-10-04', '11:00'),
    read: false,
    href: '/guardian/schedule',
  },
  {
    id: 'n3',
    kind: 'balance',
    title: 'رصيد الباقة منخفض',
    body: 'بقيت حصة واحدة في باقة عبدالرحمن، وتنتهي صلاحيتها 14 أكتوبر.',
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
    body: 'عبدالرحمن: البيّنة 1–5، تقدير جيد جدًا.',
    at: riyadh('2026-10-01', '17:20'),
    read: true,
    href: '/guardian/reports/r4',
  },
  {
    id: 'n6',
    kind: 'report',
    title: 'تقرير الحفظ جاهز',
    body: 'ريم: المدثر 1–31، تقدير ممتاز.',
    at: riyadh('2026-09-29', '18:02'),
    read: true,
    href: '/guardian/reports/r1',
  },
];

/** حصص المعلمة هند اليوم */
export const teacherToday = [
  { id: 'ts1', student: 'سارة المطيري', category: 'طالبة بالغة', startsAt: riyadh('2026-10-04', '13:35'), durationMin: 45, focus: 'حفظ جديد: آل عمران 92–120' },
  { id: 'ts2', student: 'لين الدوسري', category: 'طفلة · 8 سنوات', startsAt: riyadh('2026-10-04', '15:00'), durationMin: 30, focus: 'مراجعة: الفجر 1–14' },
  { id: 'x04', student: 'ريم السبيعي', category: 'طفلة · 9 سنوات', startsAt: riyadh('2026-10-04', '17:00'), durationMin: 45, focus: 'حفظ جديد: المدثر 32–56' },
  { id: 'ts4', student: 'هيا الشمري', category: 'طالبة بالغة', startsAt: riyadh('2026-10-04', '19:30'), durationMin: 60, focus: 'تسميع: الكهف 1–16' },
];

/** حصص بلا تقرير بعد — المهلة 12 ساعة من نهاية الحصة */
export const teacherPendingReports = [
  { sessionId: 'ts0', student: 'ليان العنزي', startsAt: riyadh('2026-10-04', '09:00'), durationMin: 45 },
  { sessionId: 'tsy', student: 'جود الحربي', startsAt: riyadh('2026-10-03', '20:30'), durationMin: 30 },
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
  revenueMonth: 84_600,
  attendance: 93,
};

export const pendingPayments = [
  { ref: 'MAAB-2026-000148', payer: 'نورة السبيعي', student: 'عبدالرحمن', plan: 'basic' as PlanId, duration: 30 as Duration, amount: 180, uploadedAt: riyadh('2026-10-03', '20:12'), file: 'receipt-oct.pdf', senderName: 'نورة محمد السبيعي' },
  { ref: 'MAAB-2026-000150', payer: 'سارة المطيري', student: 'سارة المطيري', plan: 'intensive' as PlanId, duration: 45 as Duration, amount: 650, uploadedAt: riyadh('2026-10-04', '08:41'), file: 'IMG_4410.jpg', senderName: 'سارة عبدالله المطيري' },
  { ref: 'MAAB-2026-000151', payer: 'أم فيصل الحربي', student: 'جود الحربي', plan: 'regular' as PlanId, duration: 30 as Duration, amount: 340, uploadedAt: riyadh('2026-10-04', '10:05'), file: 'transfer-jood.pdf', senderName: 'منيرة سعد الحربي' },
  { ref: 'MAAB-2026-000146', payer: 'خلود الدوسري', student: 'لين الدوسري', plan: 'regular' as PlanId, duration: 30 as Duration, amount: 340, uploadedAt: riyadh('2026-10-02', '22:30'), file: 'IMG_0912.png', senderName: 'خلود ناصر الدوسري' },
  { ref: 'MAAB-2026-000152', payer: 'هيا الشمري', student: 'هيا الشمري', plan: 'basic' as PlanId, duration: 60 as Duration, amount: 300, uploadedAt: riyadh('2026-10-04', '11:52'), file: 'receipt.pdf', senderName: 'هيا فهد الشمري' },
  { ref: 'MAAB-2026-000149', payer: 'ريما العنزي', student: 'ليان العنزي', plan: 'regular' as PlanId, duration: 45 as Duration, amount: 460, uploadedAt: riyadh('2026-10-03', '23:18'), file: 'IMG_7781.jpg', senderName: 'ريما خالد العنزي' },
];

export const applications: TeacherApplication[] = [
  { id: 'a1', name: 'فاطمة الغامدي', city: 'جدة', riwayah: 'حفص عن عاصم', experienceYears: 5, submittedAt: riyadh('2026-10-03', '09:20'), status: 'new' },
  { id: 'a2', name: 'عائشة البلوي', city: 'تبوك', riwayah: 'حفص عن عاصم', experienceYears: 3, submittedAt: riyadh('2026-10-02', '14:05'), status: 'new' },
  { id: 'a3', name: 'نوف الشهري', city: 'أبها', riwayah: 'حفص وشعبة', experienceYears: 8, submittedAt: riyadh('2026-09-30', '11:40'), status: 'under_review' },
  { id: 'a4', name: 'منى العمري', city: 'المدينة المنورة', riwayah: 'حفص عن عاصم', experienceYears: 4, submittedAt: riyadh('2026-09-28', '16:10'), status: 'needs_info', missing: 'صورة الإجازة غير واضحة' },
  { id: 'a5', name: 'رزان القرشي', city: 'مكة المكرمة', riwayah: 'حفص عن عاصم', experienceYears: 6, submittedAt: riyadh('2026-09-25', '10:00'), status: 'interview', interviewAt: riyadh('2026-10-05', '11:00') },
  { id: 'a6', name: 'شهد المالكي', city: 'الطائف', riwayah: 'حفص عن عاصم', experienceYears: 2, submittedAt: riyadh('2026-09-21', '13:30'), status: 'accepted' },
  { id: 'a7', name: 'لمى الحارثي', city: 'الرياض', riwayah: 'حفص عن عاصم', experienceYears: 1, submittedAt: riyadh('2026-09-19', '19:45'), status: 'rejected' },
];

/** الآيات المحفوظة حفظاً جديداً كل شهر — لمخطط «كمية الحفظ» */
const MONTHS = ['أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'];
export const monthlyAyahs: Record<string, { month: string; value: number }[]> = {
  s1: [42, 48, 62, 55, 80, 126].map((value, i) => ({ month: MONTHS[i], value })),
  s2: [8, 10, 12, 9, 14, 16].map((value, i) => ({ month: MONTHS[i], value })),
};
