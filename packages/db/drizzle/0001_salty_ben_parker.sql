ALTER TABLE "listing_keywords" ADD COLUMN "missing_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "search_jobs" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;