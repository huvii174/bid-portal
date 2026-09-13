CREATE TABLE "fx_rates" (
	"currency" text PRIMARY KEY NOT NULL,
	"per_usd" numeric(20, 8) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_currency" text;