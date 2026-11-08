CREATE TABLE "capture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"request_id" text NOT NULL,
	"status" text NOT NULL,
	"paypal_capture_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_promise_attempt_uq" UNIQUE("promise_id","attempt")
);
--> statement-breakpoint
CREATE TABLE "condition_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"source" text NOT NULL,
	"fact" jsonb NOT NULL,
	"evidence_url" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"paypal_order_id" text,
	"payer_name" text DEFAULT 'anonymous' NOT NULL,
	"payer_email" text,
	"condition" jsonb DEFAULT '{"kind":"none"}'::jsonb NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promise_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture" ADD CONSTRAINT "capture_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condition_snapshot" ADD CONSTRAINT "condition_snapshot_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_event" ADD CONSTRAINT "promise_event_promise_id_promise_id_fk" FOREIGN KEY ("promise_id") REFERENCES "public"."promise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "condition_snapshot_promise_idx" ON "condition_snapshot" USING btree ("promise_id","captured_at");--> statement-breakpoint
CREATE INDEX "promise_event_promise_idx" ON "promise_event" USING btree ("promise_id","created_at");