import type { Attendance, SegmentType, SessionStatus } from './types';

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  new: 'حفظ جديد',
  near_review: 'مراجعة قريبة',
  far_review: 'مراجعة بعيدة',
  recitation: 'تسميع',
  test: 'اختبار',
};

export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  teacher_absent: 'غياب المعلمة',
};

export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' | 'gold' }> = {
  scheduled: { label: 'مجدولة', tone: 'gold' },
  completed: { label: 'حضور', tone: 'success' },
  student_absent: { label: 'غياب الطالب', tone: 'danger' },
  teacher_absent: { label: 'غياب المعلمة · تعويض', tone: 'warning' },
  cancelled: { label: 'ملغاة', tone: 'neutral' },
};
