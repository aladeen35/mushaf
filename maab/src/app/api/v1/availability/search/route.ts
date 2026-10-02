import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { asSystem } from '@/server/db/client';
import { singleOptions, weeklyOptions } from '@/server/services/scheduling';

// المواعيد بتوقيت المستخدم نفسه؛ القاعدة والحجز بـUTC
export const GET = route({}, async (ctx) => {
  const q = ctx.query(S.availabilitySearch);
  const tz = ctx.viewer.user.timezone;
  return asSystem(ctx.viewer.userId, async (tx) =>
    q.mode === 'weekly'
      ? { timezone: tz, weekly: await weeklyOptions(tx, { teacherId: q.teacherId, durationMin: q.durationMin, tz, weeks: q.weeks }) }
      : { timezone: tz, slots: await singleOptions(tx, { teacherId: q.teacherId, durationMin: q.durationMin, tz, days: q.days, ignoreSessionId: q.ignoreSessionId }) },
  );
});
