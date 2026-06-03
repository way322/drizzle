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

export function normalizeGenreKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBlockedGenre(name) {
  const key = normalizeGenreKey(name);
  if (!key) return true;
  if (BLOCKED_GENRE_EXACT.has(key)) return true;
  return BLOCKED_GENRE_PARTS.some((part) => key.includes(part));
}
