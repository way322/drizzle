CREATE TABLE "user_anime_progress" (
	"user_id" integer NOT NULL,
	"anime_id" integer NOT NULL,
	"episode_id" integer NOT NULL,
	"progress_sec" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_anime_progress_user_id_anime_id_pk" PRIMARY KEY("user_id","anime_id")
);
--> statement-breakpoint
ALTER TABLE "user_anime_progress" ADD CONSTRAINT "user_anime_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_anime_progress" ADD CONSTRAINT "user_anime_progress_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_anime_progress" ADD CONSTRAINT "user_anime_progress_episode_id_anime_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."anime_episodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_anime_progress_user_updated_idx" ON "user_anime_progress" USING btree ("user_id","updated_at");