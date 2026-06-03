const BLOCKED_GENRE_EXACT = new Set(
  [
    "хентай",
    "hentai",
    "эротика",
    "erotica",
    "яой",
    "yaoi",
    "юри",
    "yuri",
    "сёнэн-ай",
    "сёдзё-ай",
    "shounen ai",
    "shoujo ai",
    "boys love",
    "girls love",
    "bl",
    "gl",
    "18+",
    "18 plus",
    "для взрослых",
    "adult",
    "хардкор",
    "soft yaoi",
    "soft yuri",
  ].map((x) => normalizeGenreKey(x))
);

const BLOCKED_GENRE_PARTS = ["хентай", "hentai", "эрот", "erot", "yaoi", "яой", "yuri", "юри", "18+"];

export function normalizeGenreKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBlockedGenre(name: string) {
  const key = normalizeGenreKey(name);
  if (!key) return true;
  if (BLOCKED_GENRE_EXACT.has(key)) return true;
  return BLOCKED_GENRE_PARTS.some((part) => key.includes(part));
}

export function filterVisibleGenres<T extends { name: string }>(rows: T[]) {
  return rows.filter((row) => !isBlockedGenre(row.name));
}

export function filterVisibleGenreNames(names: string[]) {
  return names.filter((name) => !isBlockedGenre(name));
}
