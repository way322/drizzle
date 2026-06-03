import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  await sql`ALTER TABLE anime_episodes ADD COLUMN IF NOT EXISTS stream_variants text`;
  await sql`ALTER TABLE user_player_settings ADD COLUMN IF NOT EXISTS preferred_quality varchar(8) DEFAULT 'auto'`;
  await sql`UPDATE user_player_settings SET preferred_quality = 'auto' WHERE preferred_quality IS NULL`;
  await sql`ALTER TABLE user_player_settings ALTER COLUMN preferred_quality SET DEFAULT 'auto'`;
  await sql`ALTER TABLE user_player_settings ALTER COLUMN preferred_quality SET NOT NULL`;

  const inserted = await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    SELECT ${"0010_video_quality_variants"}, ${Date.now()}
    WHERE NOT EXISTS (
      SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${"0010_video_quality_variants"}
    )
  `.catch(() => null);

  if (inserted === null) {
    console.log("Note: drizzle migrations table not updated (optional).");
  }

  console.log("OK: stream_variants and preferred_quality columns are ready.");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
