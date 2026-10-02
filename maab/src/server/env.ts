// إعدادات الخادم من متغيرات البيئة — الأسرار هنا فقط، لا في الكود ولا في القاعدة.
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  MAAB_DATA: z.enum(['demo', 'db']).optional(),
  AUTH_SECRET: z.string().min(32).default('dev-only-secret-change-me-0123456789abcdef'),
  WHATSAPP_DRIVER: z.enum(['console', 'meta']).default('console'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_TEMPLATE: z.string().default('maab_otp'),
  SMS_DRIVER: z.enum(['console', 'unifonic']).default('console'),
  UNIFONIC_APP_SID: z.string().optional(),
  UNIFONIC_SENDER: z.string().default('MAAB'),
  EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('مآب <no-reply@example.com>'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MEETING_PROVIDER: z.enum(['mock', 'google']).default('mock'),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  STORAGE_DIR: z.string().default('.storage'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  APP_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** بيانات العرض إن طُلبت صراحةً أو غابت قاعدة البيانات */
export function usingDemoData(): boolean {
  const e = env();
  return e.MAAB_DATA === 'demo' || (!e.MAAB_DATA && !e.DATABASE_URL);
}

export const isProduction = () => process.env.NODE_ENV === 'production';
