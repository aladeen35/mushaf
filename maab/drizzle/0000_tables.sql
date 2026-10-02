CREATE TYPE "public"."application_status" AS ENUM('new', 'under_review', 'needs_info', 'interview', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent', 'teacher_absent');--> statement-breakpoint
CREATE TYPE "public"."consent_kind" AS ENUM('terms', 'privacy', 'minor_data', 'no_recording');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('SAR', 'SDG', 'USD');--> statement-breakpoint
CREATE TYPE "public"."file_kind" AS ENUM('id_document', 'ijazah', 'certificate', 'recording', 'receipt', 'avatar');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('female', 'male');--> statement-breakpoint
CREATE TYPE "public"."grade" AS ENUM('excellent', 'very_good', 'good', 'needs_repeat');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('pending', 'created', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mistake_kind" AS ENUM('hifz', 'tajweed', 'tashkeel', 'hesitation');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'push', 'email', 'sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed', 'read');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."otp_channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer_sa', 'sudan_transfer', 'international_transfer', 'mada', 'card', 'apple_pay', 'stc_pay');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('awaiting_transfer', 'under_review', 'approved', 'rejected', 'needs_fix', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_direction" AS ENUM('nas_to_baqarah', 'baqarah_to_nas');--> statement-breakpoint
CREATE TYPE "public"."reschedule_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role_key" AS ENUM('guardian', 'adult_student', 'minor_student', 'teacher', 'supervisor', 'finance', 'support', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."segment_type" AS ENUM('new', 'near_review', 'far_review', 'recitation', 'test');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('held', 'scheduled', 'completed', 'student_absent', 'teacher_absent', 'excused', 'technical_issue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."teacher_category" AS ENUM('children', 'women');--> statement-breakpoint
CREATE TYPE "public"."teacher_status" AS ENUM('active', 'suspended', 'inactive');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"impersonated_user_id" uuid,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "azkar" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section" text NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL,
	"repeat_count" smallint DEFAULT 1 NOT NULL,
	"virtue" text,
	"published" boolean DEFAULT false NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"page" smallint NOT NULL,
	"ayah_id" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_page_ck" CHECK ("bookmarks"."page" between 1 and 604)
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"student_id" uuid,
	"kind" "consent_kind" NOT NULL,
	"version" text NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"currency" "currency",
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"max_uses" integer,
	"max_uses_per_user" smallint DEFAULT 1 NOT NULL,
	"plan_codes" text[],
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_kind_ck" CHECK (("coupons"."kind" = 'percent' and "coupons"."value" > 0 and "coupons"."value" <= 100) or ("coupons"."kind" = 'fixed' and "coupons"."value" > 0 and "coupons"."currency" is not null)),
	CONSTRAINT "coupons_range_ck" CHECK ("coupons"."ends_at" > "coupons"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "daily_wird" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"set_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_wird_day_unique" UNIQUE("day")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ayah_id" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"kind" "file_kind" NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_mime_ck" CHECK (("files"."kind" = 'recording' and "files"."mime" in ('audio/mpeg','audio/mp4','audio/x-m4a') and "files"."size_bytes" <= 10485760)
       or ("files"."kind" <> 'recording' and "files"."mime" in ('application/pdf','image/jpeg','image/png') and "files"."size_bytes" <= 5242880))
);
--> statement-breakpoint
CREATE TABLE "guardian_students" (
	"guardian_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"relation" text DEFAULT 'parent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_students_guardian_id_student_id_pk" PRIMARY KEY("guardian_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "guardians_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"channel" text NOT NULL,
	"success" boolean NOT NULL,
	"reason" text,
	"ip" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"provider" text DEFAULT 'google_meet' NOT NULL,
	"external_event_id" text,
	"join_url" text,
	"status" "meeting_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "memorization_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"direction" "plan_direction" DEFAULT 'nas_to_baqarah' NOT NULL,
	"start_ayah" smallint NOT NULL,
	"weekly_target_ayahs" smallint NOT NULL,
	"new_ratio" smallint DEFAULT 60 NOT NULL,
	"set_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memorization_plans_studentId_unique" UNIQUE("student_id"),
	CONSTRAINT "memorization_plans_ratio_ck" CHECK ("memorization_plans"."new_ratio" between 0 and 100 and "memorization_plans"."weekly_target_ayahs" > 0)
);
--> statement-breakpoint
CREATE TABLE "memorized_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"source" text NOT NULL,
	"segment_id" uuid,
	"memorized_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memorized_ranges_range_ck" CHECK ("memorized_ranges"."to_ayah" >= "memorized_ranges"."from_ayah"),
	CONSTRAINT "memorized_ranges_source_ck" CHECK ("memorized_ranges"."source" in ('placement', 'report') and ("memorized_ranges"."source" = 'placement' or "memorized_ranges"."segment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"duration_min" smallint NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"guardian_id" uuid NOT NULL,
	"currency" "currency" NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"coupon_id" uuid,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"hold_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_ref_unique" UNIQUE("ref"),
	CONSTRAINT "orders_ref_ck" CHECK ("orders"."ref" ~ '^MAAB-[0-9]{4}-[0-9]{6}$'),
	CONSTRAINT "orders_total_ck" CHECK ("orders"."total" = "orders"."subtotal" - "orders"."discount" and "orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" "payment_method" NOT NULL,
	"currency" "currency" NOT NULL,
	"title_ar" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"instructions_ar" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"sender_name" text NOT NULL,
	"transfer_date" date NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"account_id" uuid,
	"currency" "currency" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'awaiting_transfer' NOT NULL,
	"reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"gateway_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_reason_ck" CHECK ("payments"."status" not in ('rejected', 'needs_fix') or "payments"."reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"duration_min" smallint NOT NULL,
	"currency" "currency" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_prices_duration_ck" CHECK ("plan_prices"."duration_min" in (30, 45, 60)),
	CONSTRAINT "plan_prices_amount_ck" CHECK ("plan_prices"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name_ar" text NOT NULL,
	"sessions_count" smallint NOT NULL,
	"per_week" smallint NOT NULL,
	"rollover_max" smallint NOT NULL,
	"validity_days" smallint DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code"),
	CONSTRAINT "plans_counts_ck" CHECK ("plans"."sessions_count" > 0 and "plans"."per_week" between 1 and 7 and "plans"."rollover_max" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quran_ayahs" (
	"id" smallint PRIMARY KEY NOT NULL,
	"surah_id" smallint NOT NULL,
	"ayah_number" smallint NOT NULL,
	"juz" smallint NOT NULL,
	"page" smallint NOT NULL,
	"text" text NOT NULL,
	"search_key" text NOT NULL,
	CONSTRAINT "quran_ayahs_id_ck" CHECK ("quran_ayahs"."id" between 1 and 6236)
);
--> statement-breakpoint
CREATE TABLE "quran_surahs" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"ayah_count" smallint NOT NULL,
	"place" text NOT NULL,
	"start_page" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"timezone" text NOT NULL,
	"duration_min" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_slots_weekday_ck" CHECK ("recurring_slots"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "ref_counters" (
	"year" smallint PRIMARY KEY NOT NULL,
	"last" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_ck" CHECK ("refunds"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "report_internal_notes" (
	"report_id" uuid PRIMARY KEY NOT NULL,
	"note" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"type" "segment_type" NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"homework" boolean DEFAULT false NOT NULL,
	"mastery" numeric(5, 2),
	"counted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "report_segments_range_ck" CHECK ("report_segments"."to_ayah" >= "report_segments"."from_ayah")
);
--> statement-breakpoint
CREATE TABLE "reschedule_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"proposed_starts_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" "reschedule_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"memorized_on" date NOT NULL,
	"step" smallint DEFAULT 0 NOT NULL,
	"due_on" date NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "review_schedule_range_ck" CHECK ("review_schedule"."to_ayah" >= "review_schedule"."from_ayah" and "review_schedule"."step" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" "role_key" NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"key" "role_key" PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "segment_mistakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"kind" "mistake_kind" NOT NULL,
	"count" smallint NOT NULL,
	"ayah_id" smallint,
	"note" text,
	CONSTRAINT "segment_mistakes_count_ck" CHECK ("segment_mistakes"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"side" text NOT NULL,
	"join_clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attendance" "attendance_status" NOT NULL,
	"grade" "grade",
	"mastery" numeric(5, 2),
	"guardian_note" text,
	"late" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_reports_sessionId_unique" UNIQUE("session_id"),
	CONSTRAINT "session_reports_note_ck" CHECK ("session_reports"."guardian_note" is null or char_length("session_reports"."guardian_note") <= 280),
	CONSTRAINT "session_reports_mastery_ck" CHECK ("session_reports"."mastery" is null or "session_reports"."mastery" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"is_makeup" boolean DEFAULT false NOT NULL,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_range_ck" CHECK ("sessions"."ends_at" > "sessions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"display_name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"birth_date" date NOT NULL,
	"level" text,
	"goal" text,
	"teacher_id" uuid,
	"login_code_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "students_birth_ck" CHECK ("students"."birth_date" > '1920-01-01')
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"duration_min" smallint NOT NULL,
	"sessions_total" smallint NOT NULL,
	"sessions_remaining" smallint NOT NULL,
	"rolled_over" smallint DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_orderItemId_unique" UNIQUE("order_item_id"),
	CONSTRAINT "subscriptions_remaining_ck" CHECK ("subscriptions"."sessions_remaining" >= 0 and "subscriptions"."sessions_remaining" <= "subscriptions"."sessions_total" + "subscriptions"."rolled_over"),
	CONSTRAINT "subscriptions_range_ck" CHECK ("subscriptions"."expires_at" > "subscriptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "tafsir_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"from_ayah" smallint NOT NULL,
	"to_ayah" smallint NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tafsir_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name_ar" text NOT NULL,
	"source_note" text,
	"local" boolean DEFAULT true NOT NULL,
	CONSTRAINT "tafsir_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "teacher_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"country" char(2) DEFAULT 'SA' NOT NULL,
	"city" text,
	"ijazah" text NOT NULL,
	"experience" text NOT NULL,
	"categories" "teacher_category"[] NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"missing_info" text,
	"interview_at" timestamp with time zone,
	"rejection_reason" text,
	"reviewed_by" uuid,
	"decided_at" timestamp with time zone,
	"reapply_after" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teacher_applications_reject_reason_ck" CHECK ("teacher_applications"."status" <> 'rejected' or "teacher_applications"."rejection_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "teacher_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_availability_weekday_ck" CHECK ("teacher_availability"."weekday" between 0 and 6),
	CONSTRAINT "teacher_availability_range_ck" CHECK ("teacher_availability"."end_time" >= "teacher_availability"."start_time" + interval '30 minutes')
);
--> statement-breakpoint
CREATE TABLE "teacher_discipline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" text NOT NULL,
	"minutes" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "file_kind" NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"month" date NOT NULL,
	"score" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_ratings_score_ck" CHECK ("teacher_ratings"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "teacher_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_time_off_range_ck" CHECK ("teacher_time_off"."ends_on" >= "teacher_time_off"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"headline" text,
	"riwayah" text DEFAULT 'حفص عن عاصم' NOT NULL,
	"categories" "teacher_category"[] DEFAULT '{children}' NOT NULL,
	"levels" text[] DEFAULT '{}' NOT NULL,
	"max_students" smallint DEFAULT 20 NOT NULL,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"status" "teacher_status" DEFAULT 'active' NOT NULL,
	"application_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teachers_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "teachers_max_students_ck" CHECK ("teachers"."max_students" between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role_key" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"email" text,
	"full_name" text DEFAULT '' NOT NULL,
	"country" char(2) DEFAULT 'SA' NOT NULL,
	"city" text,
	"timezone" text DEFAULT 'Asia/Riyadh' NOT NULL,
	"currency" "currency" DEFAULT 'SAR' NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"google_sub" text,
	"avatar_file_id" uuid,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_identifier_ck" CHECK ("users"."phone" is not null or "users"."email" is not null or "users"."google_sub" is not null),
	CONSTRAINT "users_phone_e164_ck" CHECK ("users"."phone" is null or "users"."phone" ~ '^\+[1-9][0-9]{6,14}$')
);
--> statement-breakpoint
ALTER TABLE "azkar" ADD CONSTRAINT "azkar_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_ayah_id_quran_ayahs_id_fk" FOREIGN KEY ("ayah_id") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_wird" ADD CONSTRAINT "daily_wird_from_ayah_quran_ayahs_id_fk" FOREIGN KEY ("from_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_wird" ADD CONSTRAINT "daily_wird_to_ayah_quran_ayahs_id_fk" FOREIGN KEY ("to_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_wird" ADD CONSTRAINT "daily_wird_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_ayah_id_quran_ayahs_id_fk" FOREIGN KEY ("ayah_id") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_students" ADD CONSTRAINT "guardian_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_plans" ADD CONSTRAINT "memorization_plans_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_plans" ADD CONSTRAINT "memorization_plans_start_ayah_quran_ayahs_id_fk" FOREIGN KEY ("start_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorization_plans" ADD CONSTRAINT "memorization_plans_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorized_ranges" ADD CONSTRAINT "memorized_ranges_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorized_ranges" ADD CONSTRAINT "memorized_ranges_from_ayah_quran_ayahs_id_fk" FOREIGN KEY ("from_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorized_ranges" ADD CONSTRAINT "memorized_ranges_to_ayah_quran_ayahs_id_fk" FOREIGN KEY ("to_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memorized_ranges" ADD CONSTRAINT "memorized_ranges_segment_id_report_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."report_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_account_id_payment_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."payment_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quran_ayahs" ADD CONSTRAINT "quran_ayahs_surah_id_quran_surahs_id_fk" FOREIGN KEY ("surah_id") REFERENCES "public"."quran_surahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_slots" ADD CONSTRAINT "recurring_slots_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_slots" ADD CONSTRAINT "recurring_slots_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_slots" ADD CONSTRAINT "recurring_slots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_internal_notes" ADD CONSTRAINT "report_internal_notes_report_id_session_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."session_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_internal_notes" ADD CONSTRAINT "report_internal_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_segments" ADD CONSTRAINT "report_segments_report_id_session_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."session_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_segments" ADD CONSTRAINT "report_segments_from_ayah_quran_ayahs_id_fk" FOREIGN KEY ("from_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_segments" ADD CONSTRAINT "report_segments_to_ayah_quran_ayahs_id_fk" FOREIGN KEY ("to_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reschedule_requests" ADD CONSTRAINT "reschedule_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_from_ayah_quran_ayahs_id_fk" FOREIGN KEY ("from_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedule" ADD CONSTRAINT "review_schedule_to_ayah_quran_ayahs_id_fk" FOREIGN KEY ("to_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_permissions_key_fk" FOREIGN KEY ("permission") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_mistakes" ADD CONSTRAINT "segment_mistakes_segment_id_report_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."report_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_mistakes" ADD CONSTRAINT "segment_mistakes_ayah_id_quran_ayahs_id_fk" FOREIGN KEY ("ayah_id") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tafsir_entries" ADD CONSTRAINT "tafsir_entries_source_id_tafsir_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."tafsir_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tafsir_entries" ADD CONSTRAINT "tafsir_entries_from_ayah_quran_ayahs_id_fk" FOREIGN KEY ("from_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tafsir_entries" ADD CONSTRAINT "tafsir_entries_to_ayah_quran_ayahs_id_fk" FOREIGN KEY ("to_ayah") REFERENCES "public"."quran_ayahs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_availability" ADD CONSTRAINT "teacher_availability_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_discipline_events" ADD CONSTRAINT "teacher_discipline_events_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_documents" ADD CONSTRAINT "teacher_documents_application_id_teacher_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."teacher_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_documents" ADD CONSTRAINT "teacher_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_time_off" ADD CONSTRAINT "teacher_time_off_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_roles_key_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_last_read_uq" ON "bookmarks" USING btree ("user_id") WHERE "bookmarks"."kind" = 'last_read';--> statement-breakpoint
CREATE INDEX "consents_user_idx" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemptions_uq" ON "coupon_redemptions" USING btree ("coupon_id","order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_uq" ON "coupons" USING btree (upper("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_uq" ON "favorites" USING btree ("user_id","ayah_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_bucket_path_uq" ON "files" USING btree ("bucket","path");--> statement-breakpoint
CREATE INDEX "guardian_students_student_idx" ON "guardian_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE INDEX "login_attempts_identifier_idx" ON "login_attempts" USING btree ("identifier","created_at");--> statement-breakpoint
CREATE INDEX "memorized_ranges_student_idx" ON "memorized_ranges" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_uq" ON "notification_templates" USING btree ("event","channel","locale");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_guardian_idx" ON "orders" USING btree ("guardian_id","created_at");--> statement-breakpoint
CREATE INDEX "otp_identifier_idx" ON "otp_challenges" USING btree ("identifier","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_prices_uq" ON "plan_prices" USING btree ("plan_id","duration_min","currency") WHERE "plan_prices"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "quran_ayahs_ref_uq" ON "quran_ayahs" USING btree ("surah_id","ayah_number");--> statement-breakpoint
CREATE INDEX "report_segments_report_idx" ON "report_segments" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "review_schedule_due_idx" ON "review_schedule" USING btree ("student_id","due_on");--> statement-breakpoint
CREATE INDEX "session_attendance_session_idx" ON "session_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_reports_student_idx" ON "session_reports" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_teacher_idx" ON "sessions" USING btree ("teacher_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_student_idx" ON "sessions" USING btree ("student_id","starts_at");--> statement-breakpoint
CREATE INDEX "students_teacher_idx" ON "students" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "subscriptions_student_idx" ON "subscriptions" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tafsir_entries_uq" ON "tafsir_entries" USING btree ("source_id","from_ayah");--> statement-breakpoint
CREATE INDEX "teacher_applications_status_idx" ON "teacher_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "teacher_availability_teacher_idx" ON "teacher_availability" USING btree ("teacher_id","weekday");--> statement-breakpoint
CREATE INDEX "teacher_discipline_teacher_idx" ON "teacher_discipline_events" USING btree ("teacher_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_ratings_uq" ON "teacher_ratings" USING btree ("teacher_id","guardian_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone") WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_uq" ON "users" USING btree ("google_sub");