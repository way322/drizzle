CREATE TABLE "anime_dubbings" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_id" integer NOT NULL,
	"title" varchar(120) NOT NULL,
	"language" varchar(20) DEFAULT 'ru' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "anime_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"anime_id" integer NOT NULL,
	"dubbing_id" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"title" varchar(180),
	"object_key" text NOT NULL,
	"stream_url" text NOT NULL,
	"intro_start_sec" integer,
	"intro_end_sec" integer,
	"outro_start_sec" integer,
	"outro_end_sec" integer,
	"duration_sec" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_player_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"preferred_dubbing_id" integer,
	"auto_skip_intro" boolean DEFAULT true NOT NULL,
	"auto_skip_outro" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anime_dubbings" ADD CONSTRAINT "anime_dubbings_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_episodes" ADD CONSTRAINT "anime_episodes_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "public"."anime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anime_episodes" ADD CONSTRAINT "anime_episodes_dubbing_id_anime_dubbings_id_fk" FOREIGN KEY ("dubbing_id") REFERENCES "public"."anime_dubbings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_player_settings" ADD CONSTRAINT "user_player_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_player_settings" ADD CONSTRAINT "user_player_settings_preferred_dubbing_id_anime_dubbings_id_fk" FOREIGN KEY ("preferred_dubbing_id") REFERENCES "public"."anime_dubbings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anime_dubbings_anime_idx" ON "anime_dubbings" USING btree ("anime_id");--> statement-breakpoint
CREATE UNIQUE INDEX "anime_episodes_anime_dub_episode_unique" ON "anime_episodes" USING btree ("anime_id","dubbing_id","episode_number");--> statement-breakpoint
CREATE INDEX "anime_episodes_anime_idx" ON "anime_episodes" USING btree ("anime_id");