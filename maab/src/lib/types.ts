import type { PaymentStatus, PlanId, Duration } from './domain/billing';
import type { Currency, PaymentMethod } from './domain/market';
import type { Grade, Mistakes } from './domain/mastery';
import type { ApplicationStatus } from './domain/teachers';
import type { AyahRef } from './quran';

export type Gender = 'female' | 'male';

export type Teacher = {
  id: string;
  name: string;
  /** وصف قصير يظهر لولي الأمر */
  headline: string;
  riwayah: string;
  rating: number;
  categories: ('children' | 'women')[];
  studentsCount: number;
};

export type Range = { from: AyahRef; to: AyahRef };

export type MemorizationPlan = {
  direction: 'nas_to_baqarah' | 'baqarah_to_nas';
  /** الهدف الأسبوعي بالآيات */
  weeklyTarget: number;
  newRatio: number;
};

export type Student = {
  id: string;
  name: string;
  fullName: string;
  gender: Gender;
  birthDate: string;
  /** ولي أمر يدير الملف، أو الطالبة البالغة ولية أمر نفسها */
  guardianId: string;
  teacherId: string;
  level: string;
  goal: string;
  /** الاشتراك الفعّال — لا يوجد قبل أول باقة */
  subscription: {
    plan: PlanId;
    duration: Duration;
    total: number;
    remaining: number;
    startedAt: string;
    expiresAt: string;
    days: string[];
    time: string;
  } | null;
  plan: MemorizationPlan;
  memorized: Range[];
  current: Range;
};

export type SessionStatus = 'scheduled' | 'completed' | 'student_absent' | 'teacher_absent' | 'excused' | 'technical_issue' | 'cancelled';

export type Session = {
  id: string;
  studentId: string;
  teacherId: string;
  startsAt: string;
  durationMin: number;
  status: SessionStatus;
  reportId?: string;
  reschedule?: { proposedAt: string; by: 'teacher' | 'guardian'; reason: string; requestId?: string };
};

export type SegmentType = 'new' | 'near_review' | 'far_review' | 'recitation' | 'test';

export type Segment = Range & { type: SegmentType; mistakes: Mistakes; note?: string };

export type Attendance = 'present' | 'late' | 'absent' | 'teacher_absent';

export type Report = {
  id: string;
  sessionId: string;
  studentId: string;
  teacherId: string;
  attendance: Attendance;
  segments: Segment[];
  /** لا تقدير للحصة التي غاب عنها الطالب أو المعلمة */
  grade: Grade | null;
  guardianNote: string;
  internalNote?: string;
  homework: (Range & { type: SegmentType })[];
  writtenAt: string;
};

export type Payment = {
  ref: string;
  studentId: string;
  plan: PlanId;
  duration: Duration;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  /** آخر موعد للتحويل قبل أن تتحرّر الأوقات (يمتدّ عند طلب التصحيح) */
  holdExpiresAt?: string;
  receipt?: { fileName: string; senderName: string; transferDate: string; uploadedAt: string };
  reason?: string;
};

export type PaymentAccount = {
  method: PaymentMethod;
  currency: Currency;
  title: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
};

export type NotificationKind = 'reminder' | 'report' | 'payment' | 'balance' | 'reschedule' | 'teacher' | 'sharafa';

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  /** إشعار يتطلب ردّاً (قبول/رفض) */
  actionable?: boolean;
  /** للشرافة: الطالب والجزء الذي أتمّه */
  meta?: { studentId?: string; juz?: number };
};

export type TeacherApplication = {
  id: string;
  name: string;
  city: string;
  riwayah: string;
  experienceYears: number;
  submittedAt: string;
  status: ApplicationStatus;
  missing?: string;
  interviewAt?: string;
};
