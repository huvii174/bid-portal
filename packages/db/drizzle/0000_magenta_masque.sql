CREATE TABLE "adapter_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"search_job_id" uuid,
	"keyword" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"items_found" integer DEFAULT 0 NOT NULL,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"error_text" text
);
--> statement-breakpoint
CREATE TABLE "auction_houses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_house_id" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_auction_id" text NOT NULL,
	"auction_house_id" uuid,
	"title" text,
	"format" text DEFAULT 'unknown' NOT NULL,
	"currency" text,
	"buyer_premium_rate" numeric(6, 3),
	"starts_at_utc" timestamp with time zone,
	"ends_at_utc" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "keyword_cache" (
	"keyword" text NOT NULL,
	"source_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "keyword_cache_keyword_source_id_pk" PRIMARY KEY("keyword","source_id")
);
--> statement-breakpoint
CREATE TABLE "listing_keywords" (
	"listing_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"source_id" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"last_matched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_keywords_listing_id_keyword_pk" PRIMARY KEY("listing_id","keyword")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_listing_id" text NOT NULL,
	"auction_id" uuid,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumb_url" text,
	"source_category" text,
	"lot_no" text,
	"currency" text,
	"price_kind" text DEFAULT 'unknown' NOT NULL,
	"price_amount" numeric(14, 2),
	"price_amount_high" numeric(14, 2),
	"raw_price_text" text,
	"estimate_low" numeric(14, 2),
	"estimate_high" numeric(14, 2),
	"raw_estimate_text" text,
	"ends_at_utc" timestamp with time zone,
	"ends_at_tz" text,
	"end_time_is_approximate" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"missing_streak" integer DEFAULT 0 NOT NULL,
	"raw_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload_json" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"cadence_hours" integer DEFAULT 12 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"requested_by_user_id" uuid,
	"saved_search_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "search_matches" (
	"saved_search_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "search_matches_saved_search_id_listing_id_pk" PRIMARY KEY("saved_search_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"robots_note" text,
	"min_request_interval_ms" integer DEFAULT 2000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adapter_runs" ADD CONSTRAINT "adapter_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adapter_runs" ADD CONSTRAINT "adapter_runs_search_job_id_search_jobs_id_fk" FOREIGN KEY ("search_job_id") REFERENCES "public"."search_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_houses" ADD CONSTRAINT "auction_houses_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_auction_house_id_auction_houses_id_fk" FOREIGN KEY ("auction_house_id") REFERENCES "public"."auction_houses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_cache" ADD CONSTRAINT "keyword_cache_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_keywords" ADD CONSTRAINT "listing_keywords_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_keywords" ADD CONSTRAINT "listing_keywords_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_jobs" ADD CONSTRAINT "search_jobs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_matches" ADD CONSTRAINT "search_matches_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_matches" ADD CONSTRAINT "search_matches_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adapter_runs_source_started_idx" ON "adapter_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_houses_source_uq" ON "auction_houses" USING btree ("source_id","source_house_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auctions_source_uq" ON "auctions" USING btree ("source_id","source_auction_id");--> statement-breakpoint
CREATE INDEX "listing_keywords_keyword_idx" ON "listing_keywords" USING btree ("keyword","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_uq" ON "listings" USING btree ("source_id","source_listing_id");--> statement-breakpoint
CREATE INDEX "listings_status_ends_idx" ON "listings" USING btree ("status","ends_at_utc");--> statement-breakpoint
CREATE INDEX "listings_fts_idx" ON "listings" USING gin (to_tsvector('simple', "title" || ' ' || coalesce("description", '')));--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_user_keyword_uq" ON "saved_searches" USING btree ("user_id","keyword");--> statement-breakpoint
CREATE INDEX "search_jobs_keyword_idx" ON "search_jobs" USING btree ("keyword","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_listing_uq" ON "watchlist_items" USING btree ("user_id","listing_id");