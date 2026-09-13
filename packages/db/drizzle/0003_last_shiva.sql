DROP TABLE "saved_searches" CASCADE;--> statement-breakpoint
DROP TABLE "search_matches" CASCADE;--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "ends_at_tz";--> statement-breakpoint
ALTER TABLE "search_jobs" DROP COLUMN "saved_search_id";