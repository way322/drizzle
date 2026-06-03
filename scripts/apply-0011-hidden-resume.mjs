import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "user_hidden_resume" (
      "user_id" integer NOT NULL REFERENCES "users"("id"),
      "anime_id" integer NOT NULL REFERENCES "anime"("id"),
      "created_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "user_hidden_resume_user_anime_pk" PRIMARY KEY("user_id","anime_id")
    )
  `;
  console.log("OK: user_hidden_resume table is ready.");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
