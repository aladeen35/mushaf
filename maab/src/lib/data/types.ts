// شكل البيانات التي تعرضها الشاشات، من مصدرين بالشكل نفسه: بيانات العرض
// (النسخة الثابتة على GitHub Pages)، وقاعدة البيانات لمستخدم مسجّل (live).
import type { Duration, PlanId } from '../domain/billing';
import type { CountryCode, Currency, PaymentMethod } from '../domain/market';
import type { AppNotification, Payment, PaymentAccount, Range, Report, Session, Student, Teacher, TeacherApplication } from '../types';

export type Section = 'guardian' | 'teacher' | 'admin';

export type GuardianProfile = {
  id: string;
  name: string;
  role: string;
  city: string;
  country: CountryCode;
  timezone: string;
  currency: Currency;
  phone: string;
  email: string;
};

export type TeacherSession = {
  id: string;
  studentId: string;
  student: string;
  category: string;
  startsAt: string;
  durationMin: number;
  focus: string;
  /** المقطع المتوقع للحصة: واجب التقرير السابق أو موضع الخطة */
  current?: Range;
};

export type PendingReport = { sessionId: string; studentId: string; student: string; startsAt: string; durationMin: number };

export type RosterEntry = { id: string; name: string; category: string; current: string; page: number; mastery: number; nextAt: string | null };

export type AdminKpis = {
  activeStudents: number;
  teachers: number;
  activeSubscriptions: number;
  endingThisWeek: number;
  revenueMonth: Partial<Record<Currency, number>>;
  attendance: number;
};

export type AdminQueue = { payments: number; applications: number; reschedules: number; unassigned: number; lateReports: number };

export type PendingPayment = {
  /** معرّف الدفعة في القاعدة (فارغ في بيانات العرض) */
  id?: string;
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
  fileId?: string;
  senderName: string;
};

export type Prices = Record<Currency, Record<PlanId, Partial<Record<Duration, number>>>>;

export type TeacherStats = { students: number; hours30d: number; attendance: number; rating: number | null; unread: number };

export type RawData = {
  guardian: GuardianProfile;
  students: Student[];
  teachers: Teacher[];
  sessions: Session[];
  reports: Report[];
  payments: Payment[];
  notifications: AppNotification[];
  PRICES: Prices;
  PAYMENT_ACCOUNTS: PaymentAccount[];
  monthlyAyahs: Record<string, { month: string; value: number }[]>;
  /** المعلمة الحالية في شاشات المعلمة */
  me: Teacher | null;
  teacherStats: TeacherStats | null;
  /** إتاحة المعلمة الأسبوعية بتوقيتها (0 = الأحد) */
  availability: { timezone: string; windows: { weekday: number; start: string; end: string }[] } | null;
  teacherToday: TeacherSession[];
  teacherPendingReports: PendingReport[];
  teacherRoster: RosterEntry[];
  adminKpis: AdminKpis;
  adminQueue: AdminQueue;
  pendingPayments: PendingPayment[];
  applications: TeacherApplication[];
  /** آخر ما في سجل التدقيق لمن يملك صلاحيته */
  audit: { who: string; what: string; at: string }[];
  /** الحصص المكتملة في الأسابيع الستة الأخيرة */
  weeklySessions: { label: string; value: number }[];
};
