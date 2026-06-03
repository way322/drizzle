import "dotenv/config";
import postgres from "postgres";
import { isBlockedGenre } from "./genre-filters.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const genres = await sql`SELECT id, name FROM genres`;
  const blocked = genres.filter((g) => isBlockedGenre(g.name));

  if (!blocked.length) {
    console.log("OK: blocked genres not found in DB.");
    process.exit(0);
  }

  const ids = blocked.map((g) => g.id);
  await sql`DELETE FROM anime_genres WHERE genre_id IN ${sql(ids)}`;
  const deleted = await sql`DELETE FROM genres WHERE id IN ${sql(ids)} RETURNING name`;

  console.log(`Removed ${deleted.length} genres:`);
  for (const row of deleted) console.log(` - ${row.name}`);
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
