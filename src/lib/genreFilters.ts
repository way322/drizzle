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

function pickPreferredGenreVariant(variants: string[]) {
  const capitalized = variants.find((name) => {
    const first = name.charAt(0);
    return first === first.toUpperCase() && first !== first.toLowerCase();
  });
  return capitalized ?? variants[0];
}

export function dedupeGenreNames(names: string[]) {
  const byKey = new Map<string, string[]>();

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || isBlockedGenre(trimmed)) continue;
    const key = normalizeGenreKey(trimmed);
    const list = byKey.get(key) ?? [];
    list.push(trimmed);
    byKey.set(key, list);
  }

  return Array.from(byKey.values())
    .map((variants) => pickPreferredGenreVariant(variants))
    .sort((a, b) => a.localeCompare(b, "ru"));
}

export function filterVisibleGenres<T extends { name: string }>(rows: T[]) {
  const names = dedupeGenreNames(rows.map((row) => row.name));
  const allowed = new Set(names);
  return rows.filter((row) => allowed.has(row.name));
}

export function filterVisibleGenreNames(names: string[]) {
  return dedupeGenreNames(names);
}
