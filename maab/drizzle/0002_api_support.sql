CREATE TABLE "idempotency_keys" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"status" smallint,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_identifier_ck";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "student_login" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotency_created_idx" ON "idempotency_keys" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_order_item_idx" ON "sessions" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_login_code_uq" ON "students" USING btree ("login_code_hash");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_identifier_ck" CHECK ("users"."phone" is not null or "users"."email" is not null or "users"."google_sub" is not null or "users"."student_login");--> statement-breakpoint
-- جدول للنظام وحده: بلا سياسات، فلا يصل إليه دور authenticated أو anon
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "idempotency_keys" TO service_role;
