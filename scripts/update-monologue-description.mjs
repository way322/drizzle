import "dotenv/config";
import postgres from "postgres";

const DESCRIPTION =
  "17-летнюю Маомао похищают и продают служанкой в императорский дворец. Когда дети императора заболевают, она применяет знания фармацевта и втягивается в придворные тайны и расследования.";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  const rows = await sql`
    SELECT id, title, description
    FROM anime
    WHERE lower(title) LIKE '%монолог%'
       OR lower(title) LIKE '%фармацевт%'
  `;

  if (!rows.length) {
    console.error("Anime not found");
    process.exit(1);
  }

  for (const row of rows) {
    await sql`UPDATE anime SET description = ${DESCRIPTION} WHERE id = ${row.id}`;
    console.log(`Updated #${row.id}: ${row.title}`);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
