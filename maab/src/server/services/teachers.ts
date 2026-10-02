// المعلمات (القسم 5): طلب الانضمام ومراحله حتى القبول، والقبول يُنشئ حساب
// المعلمة ودورها، والرفض يحدد موعد إعادة التقديم. الإتاحة الأسبوعية بتوقيتها.
import { and, asc, avg, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { parsePhone } from '@/lib/phone';
import { defaultTimezone, currencyFor, type CountryCode } from '@/lib/domain/market';
import { can } from '@/lib/domain/permissions';
import { canMoveApplication, REAPPLY_AFTER_DAYS, type ApplicationStatus } from '@/lib/domain/teachers';
import { addDays, isValidTimezone, toMinutes } from '@/lib/tz';
import { asSystem, type Tx } from '../db/client';
import { teacherApplications, teacherAvailability, teacherDocuments, teacherRatings, teachers, userRoles, users } from '../db/schema';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { audit } from './audit';
import { storeFile, type FileKind } from './files';
import { notify } from './notifications';

export type ApplicationInput = {
  fullName: string;
  phone: string;
  country: CountryCode;
  email?: string | null;
  city?: string | null;
  ijazah: string;
  experience: string;
  categories: ('children' | 'women')[];
  documents: { kind: Extract<FileKind, 'id_document' | 'ijazah' | 'certificate' | 'recording'>; bytes: Uint8Array }[];
};

const OPEN: ApplicationStatus[] = ['new', 'under_review', 'needs_info', 'interview'];

export async function submitApplication(viewer: Viewer | null, input: ApplicationInput, ip?: string | null) {
  const phone = parsePhone(input.phone, input.country);
  if (!phone) throw badRequest('phone_invalid', 'رقم الجوال غير صحيح');
  if (!input.documents.some((d) => d.kind === 'id_document')) throw badRequest('id_required', 'صورة الهوية مطلوبة');
  if (!input.documents.some((d) => d.kind === 'ijazah')) throw badRequest('ijazah_required', 'صورة الإجازة مطلوبة');
  return asSystem(viewer?.userId ?? null, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'apply:' + phone.e164}))`);
    const prev = await tx.select().from(teacherApplications).where(and(eq(teacherApplications.phone, phone.e164), isNull(teacherApplications.deletedAt))).orderBy(desc(teacherApplications.createdAt));
    if (prev.some((p) => OPEN.includes(p.status))) throw conflict('application_exists', 'لديكِ طلب قيد المراجعة بهذا الرقم');
    const blocked = prev.find((p) => p.status === 'rejected' && p.reapplyAfter && p.reapplyAfter > new Date().toISOString().slice(0, 10));
    if (blocked) throw new ApiError(409, 'reapply_later', `يمكن إعادة التقديم بعد ${blocked.reapplyAfter}`, { reapplyAfter: blocked.reapplyAfter });
    if (prev.some((p) => p.status === 'accepted')) throw conflict('already_teacher', 'هذا الرقم لمعلمة في الأكاديمية');

    const [app] = await tx
      .insert(teacherApplications)
      .values({
        userId: viewer?.userId ?? null,
        fullName: input.fullName.trim(),
        phone: phone.e164,
        email: input.email ?? null,
        country: phone.country,
        city: input.city ?? null,
        ijazah: input.ijazah,
        experience: input.experience,
        categories: input.categories,
      })
      .returning();
    for (const d of input.documents) {
      const f = await storeFile(tx, { ownerId: viewer?.userId ?? null, kind: d.kind, bytes: d.bytes });
      await tx.insert(teacherDocuments).values({ applicationId: app.id, kind: d.kind, fileId: f.id });
    }
    await audit(tx, viewer, { action: 'application.submit', entity: 'teacher_applications', entityId: app.id }, ip);
    return { id: app.id, status: app.status };
  });
}

export async function listApplications(viewer: Viewer, status?: ApplicationStatus) {
  if (!can(viewer.roles, 'teachers.approve')) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    const rows = await tx
      .select()
      .from(teacherApplications)
      .where(and(isNull(teacherApplications.deletedAt), status ? eq(teacherApplications.status, status) : undefined))
      .orderBy(asc(teacherApplications.createdAt));
    const docs = rows.length ? await tx.select().from(teacherDocuments).where(inArray(teacherDocuments.applicationId, rows.map((r) => r.id))) : [];
    return rows.map((r) => ({ ...r, documents: docs.filter((d) => d.applicationId === r.id).map((d) => ({ kind: d.kind, fileId: d.fileId })) }));
  });
}

export type MoveInput = { status: ApplicationStatus; missingInfo?: string; interviewAt?: Date; rejectionReason?: string };

export async function moveApplication(viewer: Viewer, id: string, input: MoveInput, ip?: string | null) {
  if (!can(viewer.roles, 'teachers.approve')) throw forbidden();
  if (input.status === 'rejected' && !input.rejectionReason?.trim()) throw new ApiError(422, 'reason_required', 'سبب الرفض مطلوب');
  if (input.status === 'needs_info' && !input.missingInfo?.trim()) throw new ApiError(422, 'missing_info_required', 'اذكري المعلومات المطلوبة');
  if (input.status === 'interview' && !input.interviewAt) throw new ApiError(422, 'interview_time_required', 'حدّدي موعد المقابلة');
  return asSystem(viewer.userId, async (tx) => {
    const [app] = await tx.select().from(teacherApplications).where(eq(teacherApplications.id, id)).for('update');
    if (!app) throw notFound('الطلب');
    if (!canMoveApplication(app.status, input.status)) throw conflict('invalid_transition', 'لا يمكن نقل الطلب لهذه المرحلة');
    const decided = input.status === 'accepted' || input.status === 'rejected';
    const [after] = await tx
      .update(teacherApplications)
      .set({
        status: input.status,
        missingInfo: input.status === 'needs_info' ? input.missingInfo : app.missingInfo,
        interviewAt: input.interviewAt ?? app.interviewAt,
        rejectionReason: input.status === 'rejected' ? input.rejectionReason : null,
        reviewedBy: viewer.userId,
        decidedAt: decided ? new Date() : null,
        reapplyAfter: input.status === 'rejected' ? addDays(new Date().toISOString().slice(0, 10), REAPPLY_AFTER_DAYS) : null,
      })
      .where(eq(teacherApplications.id, id))
      .returning();

    let teacherId: string | null = null;
    let userId = app.userId;
    if (input.status === 'accepted') {
      teacherId = await activateTeacher(tx, viewer, app);
      userId = (await tx.select({ userId: teachers.userId }).from(teachers).where(eq(teachers.id, teacherId)))[0].userId;
    }
    if (userId) {
      const message = {
        under_review: 'طلبكِ قيد المراجعة.',
        needs_info: `نحتاج منكِ: ${input.missingInfo}`,
        interview: 'حُدّد موعد المقابلة، راجعي التطبيق.',
        accepted: 'مبارك! قُبلتِ معلمةً في أكاديمية مآب. حبابك.',
        rejected: `نعتذر عن قبول الطلب: ${input.rejectionReason}`,
        new: '',
      }[input.status];
      if (message) await notify(tx, { userIds: [userId], event: 'application_update', vars: { message }, data: { applicationId: id, status: input.status } });
    }
    await audit(tx, viewer, { action: `application.${input.status}`, entity: 'teacher_applications', entityId: id, before: { status: app.status }, after: { status: after.status, teacherId }, reason: input.rejectionReason ?? input.missingInfo ?? null }, ip);
    return { id, status: after.status, teacherId };
  });
}

/** القبول: حساب بالجوال إن لم يوجد، ودور المعلمة، وملفها بفئاتها */
async function activateTeacher(tx: Tx, viewer: Viewer, app: typeof teacherApplications.$inferSelect): Promise<string> {
  const country = app.country as CountryCode;
  let [user] = app.userId ? await tx.select().from(users).where(eq(users.id, app.userId)) : await tx.select().from(users).where(and(eq(users.phone, app.phone), isNull(users.deletedAt)));
  if (!user) {
    [user] = await tx
      .insert(users)
      .values({ phone: app.phone, email: app.email, fullName: app.fullName, country, city: app.city, timezone: defaultTimezone(country), currency: currencyFor(country) })
      .returning();
  }
  await tx.insert(userRoles).values({ userId: user.id, role: 'teacher', grantedBy: viewer.userId }).onConflictDoNothing();
  const [t] = await tx
    .insert(teachers)
    .values({ userId: user.id, displayName: app.fullName.split(/\s+/).slice(0, 2).join(' '), categories: app.categories, timezone: user.timezone, applicationId: app.id })
    .onConflictDoUpdate({ target: teachers.userId, set: { status: 'active', categories: app.categories, applicationId: app.id, deletedAt: null } })
    .returning();
  return t.id;
}

// —— الإتاحة ——

export type Window = { weekday: number; start: string; end: string };

export async function getAvailability(teacherId: string) {
  return asSystem(null, async (tx) => {
    const [t] = await tx.select({ timezone: teachers.timezone }).from(teachers).where(eq(teachers.id, teacherId));
    if (!t) throw notFound('المعلمة');
    const rows = await tx.select().from(teacherAvailability).where(eq(teacherAvailability.teacherId, teacherId)).orderBy(asc(teacherAvailability.weekday), asc(teacherAvailability.startTime));
    return { timezone: t.timezone, windows: rows.map((r) => ({ weekday: r.weekday, start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) })) };
  });
}

export async function putAvailability(viewer: Viewer, teacherId: string, input: { timezone?: string; windows: Window[] }, ip?: string | null) {
  if (input.timezone && !isValidTimezone(input.timezone)) throw badRequest('timezone_invalid', 'منطقة زمنية غير معروفة');
  const sorted = [...input.windows].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    if (toMinutes(w.end) - toMinutes(w.start) < 30) throw new ApiError(422, 'window_short', 'كل فترة 30 دقيقة على الأقل');
    const next = sorted[i + 1];
    if (next && next.weekday === w.weekday && toMinutes(next.start) < toMinutes(w.end)) throw new ApiError(422, 'window_overlap', 'فترتان متداخلتان في اليوم نفسه');
  }
  return asSystem(viewer.userId, async (tx) => {
    const [t] = await tx.select().from(teachers).where(eq(teachers.id, teacherId));
    if (!t) throw notFound('المعلمة');
    const own = t.userId === viewer.userId && can(viewer.roles, 'availability.manage.own');
    if (!own && !can(viewer.roles, 'teachers.assign')) throw forbidden();
    const before = await tx.select().from(teacherAvailability).where(eq(teacherAvailability.teacherId, teacherId));
    await tx.delete(teacherAvailability).where(eq(teacherAvailability.teacherId, teacherId));
    if (sorted.length) await tx.insert(teacherAvailability).values(sorted.map((w) => ({ teacherId, weekday: w.weekday, startTime: w.start, endTime: w.end })));
    if (input.timezone && input.timezone !== t.timezone) await tx.update(teachers).set({ timezone: input.timezone }).where(eq(teachers.id, teacherId));
    await audit(tx, viewer, { action: 'availability.set', entity: 'teachers', entityId: teacherId, before: before.map((b) => [b.weekday, b.startTime, b.endTime]), after: sorted }, ip);
    // الحصص المحجوزة لا تُمسّ؛ التعديل يسري على الحجوزات الجديدة فقط
    return { windows: sorted.length };
  });
}

/** المعلمات المتاحات للحجز: بيانات العرض فقط، بلا جوال ولا بريد */
export async function listTeachers(q: { category?: 'children' | 'women' }) {
  return asSystem(null, async (tx) => {
    const rows = await tx
      .select({
        id: teachers.id,
        displayName: teachers.displayName,
        headline: teachers.headline,
        riwayah: teachers.riwayah,
        categories: teachers.categories,
        levels: teachers.levels,
        timezone: teachers.timezone,
        country: users.country,
        rating: avg(teacherRatings.score).mapWith(Number),
      })
      .from(teachers)
      .innerJoin(users, eq(users.id, teachers.userId))
      .leftJoin(teacherRatings, eq(teacherRatings.teacherId, teachers.id))
      .where(and(eq(teachers.status, 'active'), isNull(teachers.deletedAt), q.category ? sql`${q.category} = any(${teachers.categories})` : undefined))
      .groupBy(teachers.id, users.country)
      .orderBy(asc(teachers.displayName));
    return rows.map((r) => ({ ...r, rating: r.rating ? Math.round(r.rating * 10) / 10 : null }));
  });
}
