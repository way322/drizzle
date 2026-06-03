CREATE TABLE IF NOT EXISTS "user_hidden_resume" (
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "anime_id" integer NOT NULL REFERENCES "anime"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_hidden_resume_user_anime_pk" PRIMARY KEY("user_id","anime_id")
);
