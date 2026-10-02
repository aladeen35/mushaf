// غلاف نقاط /api/v1: كل طلب يمر بالجلسة ثم الصلاحية ثم التحقق من المدخلات
// بـZod (القسم 14)، مع حدّ الطلبات، ومفتاح منع التكرار لعمليات الحجز والدفع.
// الأدوار تُقرأ من القاعدة في كل طلب، فسحب دور من مستخدم يسري فوراً.
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import { can, isStaff, type Permission } from '@/lib/domain/permissions';
import { SESSION_COOKIE, sessionCookie, signSession, verifySession, type Session } from '../auth/session';
import { rolesOf } from '../auth/users';
import { asSystem } from '../db/client';
import { idempotencyKeys, users } from '../db/schema';
import { ApiError, errorResponse, forbidden, ok, tooMany, unauthorized } from './http';
import { rateLimit } from './rate-limit';

export type ViewerUser = Pick<
  typeof users.$inferSelect,
  'id' | 'fullName' | 'phone' | 'email' | 'country' | 'timezone' | 'currency' | 'locale'
>;

export type Viewer = Session & { user: ViewerUser };

export type Ctx<P = Record<string, string>> = {
  req: Request;
  url: URL;
  params: P;
  viewer: Viewer | null;
  ip: string | null;
  userAgent: string | null;
  /** يقرأ جسم JSON ويتحقق منه؛ الخطأ يصير 422 بالصيغة الموحّدة */
  json<S extends z.ZodType>(schema: S): Promise<z.infer<S>>;
  query<S extends z.ZodType>(schema: S): z.infer<S>;
  /** ترويسات تُضاف للاستجابة (مثل Set-Cookie) */
  headers: Headers;
};

export type AuthedCtx<P = Record<string, string>> = Omit<Ctx<P>, 'viewer'> & { viewer: Viewer };

type Options = {
  /** public: بلا جلسة، optional: الجلسة إن وُجدت، user (الافتراضي): جلسة لازمة */
  auth?: 'public' | 'optional' | 'user';
  /** صلاحية واحدة على الأقل من هذه */
  can?: Permission | Permission[];
  idempotent?: boolean;
  /** حدّ خاص بالنقطة بدل الحدّ العام */
  limit?: { max: number; windowSec: number };
};

const API_PER_MINUTE = 60;

function clientIp(req: Request): string | null {
  const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip');
  return raw && isIP(raw) ? raw : null;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
}

/** الجلسة من الكوكيز، ثم المستخدم وأدواره الحالية من القاعدة */
export async function loadViewer(req: Request): Promise<Viewer | null> {
  return viewerFromToken(readCookie(req, SESSION_COOKIE));
}

/** للمكوّنات على الخادم: الرمز من cookies() في next/headers */
export async function viewerFromToken(token: string | undefined): Promise<Viewer | null> {
  const session = await verifySession(token);
  if (!session) return null;
  return asSystem(null, async (tx) => {
    const [user] = await tx
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
        country: users.country,
        timezone: users.timezone,
        currency: users.currency,
        locale: users.locale,
      })
      .from(users)
      .where(and(eq(users.id, session.userId), isNull(users.deletedAt)));
    if (!user) return null;
    return { ...session, roles: await rolesOf(tx, user.id), user };
  });
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

type Handler<P> = (ctx: Ctx<P>) => Promise<Response | unknown>;
type AuthedHandler<P> = (ctx: AuthedCtx<P>) => Promise<Response | unknown>;

export function route<P = Record<string, string>>(opts: Options & { auth: 'public' | 'optional' }, fn: Handler<P>): RouteFn<P>;
export function route<P = Record<string, string>>(opts: Options, fn: AuthedHandler<P>): RouteFn<P>;
export function route<P = Record<string, string>>(opts: Options, fn: Handler<P> | AuthedHandler<P>): RouteFn<P> {
  const auth = opts.auth ?? 'user';
  return async (req, context) => {
    const headers = new Headers();
    try {
      const url = new URL(req.url);
      const ip = clientIp(req);
      const viewer = auth === 'public' ? null : await loadViewer(req);
      if (auth === 'user' && !viewer) throw unauthorized();

      const limit = opts.limit ?? { max: API_PER_MINUTE, windowSec: 60 };
      const bucket = `${url.pathname}:${req.method}:${viewer?.userId ?? ip ?? 'anon'}`;
      const rl = rateLimit(opts.limit ? bucket : `api:${viewer?.userId ?? ip ?? 'anon'}`, limit.max, limit.windowSec);
      if (!rl.ok) throw tooMany('طلبات كثيرة، انتظري قليلاً', rl.retryAfterSec);

      if (opts.can) {
        const needed = Array.isArray(opts.can) ? opts.can : [opts.can];
        if (!viewer || !needed.some((p) => can(viewer.roles, p))) throw forbidden();
      }

      let bodyText: string | undefined;
      const readBody = async () => (bodyText ??= await req.text());
      const ctx: Ctx<P> = {
        req,
        url,
        params: ((await context.params) ?? {}) as P,
        viewer,
        ip,
        userAgent: req.headers.get('user-agent'),
        headers,
        async json(schema) {
          const text = await readBody();
          let data: unknown = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              throw new ApiError(400, 'invalid_json', 'صيغة الطلب غير صحيحة');
            }
          }
          return schema.parse(data);
        },
        query(schema) {
          return schema.parse(Object.fromEntries(url.searchParams));
        },
      };

      const run = async () => {
        const out = await (fn as Handler<P>)(ctx);
        const res = out instanceof Response ? out : ok(out);
        // تجديد جلسة الإدارة مع كل طلب: تنتهي بعد 30 دقيقة خمول لا 30 دقيقة من
        // الدخول. إن أصدرت النقطة جلسة جديدة (دخول أو انتحال) فهي الأولى.
        const issued = headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`));
        if (viewer && isStaff(viewer.roles) && !viewer.impersonatedBy && !issued) {
          const { token, maxAge } = await signSession({ userId: viewer.userId, roles: viewer.roles });
          headers.append('Set-Cookie', sessionCookie(token, maxAge));
        }
        headers.forEach((v, k) => {
          if (k !== 'set-cookie') res.headers.append(k, v);
        });
        for (const cookie of headers.getSetCookie()) res.headers.append('Set-Cookie', cookie);
        return res;
      };

      const key = req.headers.get('idempotency-key');
      if (!opts.idempotent || !key || !viewer) return await run();
      if (key.length > 100) throw new ApiError(400, 'invalid_idempotency_key', 'مفتاح منع التكرار طويل');

      const isJson = req.headers.get('content-type')?.includes('application/json') ?? false;
      const requestHash = sha256(`${req.method} ${url.pathname}\n${isJson ? await readBody() : ''}`);
      const claimed = await asSystem(viewer.userId, (tx) =>
        tx
          .insert(idempotencyKeys)
          .values({ userId: viewer.userId, key, route: `${req.method} ${url.pathname}`, requestHash })
          .onConflictDoNothing()
          .returning({ key: idempotencyKeys.key }),
      );
      const where = and(eq(idempotencyKeys.userId, viewer.userId), eq(idempotencyKeys.key, key));
      if (!claimed.length) {
        const [prev] = await asSystem(viewer.userId, (tx) => tx.select().from(idempotencyKeys).where(where));
        if (prev.requestHash !== requestHash) {
          throw new ApiError(422, 'idempotency_mismatch', 'استُخدم مفتاح منع التكرار لطلب مختلف');
        }
        if (prev.status === null) throw new ApiError(409, 'in_progress', 'الطلب نفسه قيد التنفيذ');
        return Response.json(prev.response, { status: prev.status, headers: { 'Idempotent-Replayed': 'true' } });
      }
      let res: Response;
      try {
        res = await run();
      } catch (e) {
        res = errorResponse(e);
      }
      // تُحفظ الاستجابة الناجحة فقط؛ الفشل يحرّر المفتاح ليُعاد المحاولة به
      if (res.ok) {
        const response = await res.clone().json();
        await asSystem(viewer.userId, (tx) => tx.update(idempotencyKeys).set({ status: res.status, response }).where(where));
      } else {
        await asSystem(viewer.userId, (tx) => tx.delete(idempotencyKeys).where(where));
      }
      return res;
    } catch (e) {
      // عند الخطأ لا تُرسل كوكيز جلسة: الخطأ لا يمنح دخولاً ولا يجدّده
      return errorResponse(e);
    }
  };
}

export type RouteFn<P> = (req: Request, context: { params: Promise<P> }) => Promise<Response>;

/** يتأكد أن للمستخدم صلاحية؛ لفحوص داخل النقطة نفسها حسب الحالة */
export function assertCan(viewer: Viewer, ...permissions: Permission[]) {
  if (!permissions.some((p) => can(viewer.roles, p))) throw forbidden();
}
