// روابط الحصص (القسم 8): تُنشأ تلقائياً من حساب Gmail واحد تملكه الأكاديمية
// عبر Google Calendar API. المزوّد معزول هنا، فالانتقال لمزوّد آخر يغيّر هذا
// الملف وحده. في التطوير يُنشئ المزوّد الوهمي رابطاً شكلياً.
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { meetings, sessions, students, teachers } from '../db/schema';
import { env } from '../env';

export const MAX_MEETING_ATTEMPTS = 5;

type MeetingInput = { sessionId: string; startsAt: Date; endsAt: Date; title: string };
type Created = { eventId: string; joinUrl: string };

interface MeetingProvider {
  create(m: MeetingInput): Promise<Created>;
  update(eventId: string, m: MeetingInput): Promise<void>;
  cancel(eventId: string): Promise<void>;
}

const mock: MeetingProvider = {
  async create(m) {
    const code = (n: number) =>
      Array.from(randomBytes(n), (b) => 'abcdefghijkmnopqrstuvwxyz'[b % 25]).join('');
    return { eventId: `mock-${m.sessionId}`, joinUrl: `https://meet.google.com/${code(3)}-${code(4)}-${code(3)}` };
  },
  async update() {},
  async cancel() {},
};

let token: { value: string; exp: number } | undefined;

async function googleToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET || !e.GOOGLE_REFRESH_TOKEN) throw new Error('Google Calendar غير مهيّأ');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      refresh_token: e.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return token.value;
}

const calendar = () => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env().GOOGLE_CALENDAR_ID ?? 'primary')}/events`;

const google: MeetingProvider = {
  async create(m) {
    const res = await fetch(`${calendar()}?conferenceDataVersion=1&sendUpdates=none`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: m.title,
        start: { dateTime: m.startsAt.toISOString() },
        end: { dateTime: m.endsAt.toISOString() },
        // لا يُدعى أحد بالبريد: الرابط يصل عبر زر «ادخل الحصة» في التطبيق فقط
        guestsCanSeeOtherGuests: false,
        conferenceData: { createRequest: { requestId: m.sessionId, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    });
    if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const ev = (await res.json()) as { id: string; hangoutLink?: string };
    if (!ev.hangoutLink) throw new Error('لم يُنشأ رابط Meet');
    return { eventId: ev.id, joinUrl: ev.hangoutLink };
  },
  async update(eventId, m) {
    const res = await fetch(`${calendar()}/${eventId}?sendUpdates=none`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await googleToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: { dateTime: m.startsAt.toISOString() }, end: { dateTime: m.endsAt.toISOString() } }),
    });
    if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
  },
  async cancel(eventId) {
    const res = await fetch(`${calendar()}/${eventId}?sendUpdates=none`, { method: 'DELETE', headers: { Authorization: `Bearer ${await googleToken()}` } });
    if (!res.ok && res.status !== 410 && res.status !== 404) throw new Error(`Google Calendar ${res.status}`);
  },
};

export const provider = (): MeetingProvider => (env().MEETING_PROVIDER === 'google' ? google : mock);

/** يطلب رابطاً لحصص مؤكدة (داخل معاملة الحدث)؛ العامل ينشئه لاحقاً */
export async function requestMeetings(tx: Tx, sessionIds: string[]) {
  if (!sessionIds.length) return;
  await tx
    .insert(meetings)
    .values(sessionIds.map((sessionId) => ({ sessionId })))
    .onConflictDoUpdate({ target: meetings.sessionId, set: { status: 'pending', attempts: 0, lastError: null } });
}

/** للعامل: ينشئ الروابط المعلّقة أو يحدّث موعدها؛ يُعاد المحاولة حتى 5 مرات */
export async function processPendingMeetings(tx: Tx, limit = 20): Promise<{ created: number; failed: number }> {
  const rows = await tx
    .select({ m: meetings, s: sessions, teacher: teachers.displayName, student: students.displayName })
    .from(meetings)
    .innerJoin(sessions, eq(sessions.id, meetings.sessionId))
    .innerJoin(teachers, eq(teachers.id, sessions.teacherId))
    .innerJoin(students, eq(students.id, sessions.studentId))
    .where(and(eq(meetings.status, 'pending'), lt(meetings.attempts, MAX_MEETING_ATTEMPTS)))
    .orderBy(asc(sessions.startsAt))
    .limit(limit)
    .for('update', { of: meetings, skipLocked: true });
  let created = 0;
  let failed = 0;
  const p = provider();
  for (const { m, s, teacher, student } of rows) {
    const input = { sessionId: s.id, startsAt: s.startsAt, endsAt: s.endsAt, title: `مآب — حصة ${student} مع ${teacher}` };
    try {
      if (s.status === 'cancelled') {
        if (m.externalEventId) await p.cancel(m.externalEventId);
        await tx.update(meetings).set({ status: 'created', joinUrl: null, lastError: null }).where(eq(meetings.id, m.id));
        continue;
      }
      if (m.externalEventId && m.joinUrl) {
        await p.update(m.externalEventId, input);
        await tx.update(meetings).set({ status: 'created', lastError: null }).where(eq(meetings.id, m.id));
      } else {
        const ev = await p.create(input);
        await tx.update(meetings).set({ status: 'created', externalEventId: ev.eventId, joinUrl: ev.joinUrl, lastError: null }).where(eq(meetings.id, m.id));
      }
      created++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await tx
        .update(meetings)
        .set({ attempts, status: attempts >= MAX_MEETING_ATTEMPTS ? 'failed' : 'pending', lastError: (e as Error).message.slice(0, 500) })
        .where(eq(meetings.id, m.id));
      failed++;
    }
  }
  return { created, failed };
}

export async function meetingsFor(tx: Tx, sessionIds: string[]) {
  if (!sessionIds.length) return [];
  return tx.select().from(meetings).where(inArray(meetings.sessionId, sessionIds));
}
