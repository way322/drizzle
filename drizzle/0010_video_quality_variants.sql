ALTER TABLE "anime_episodes" ADD COLUMN IF NOT EXISTS "stream_variants" text;
--> statement-breakpoint
ALTER TABLE "user_player_settings" ADD COLUMN IF NOT EXISTS "preferred_quality" varchar(8) DEFAULT 'auto' NOT NULL;
