/** Разделитель: длинное/среднее тире или дефис. */
const TITLE_SPLIT_RE =
  /^(.+?)\s*(?:—|–|-)\s*((?:сезон|season|часть|part)\s*\d+.*)$/iu;

/** «Название Сезон 1» без тире перед сезоном. */
const TRAILING_SEASON_RE = /^(.+?)\s+((?:сезон|season|часть|part)\s*\d+.*)$/iu;

function formatMeta(meta: string) {
  return meta.replace(/((?:сезон|season|часть|part))\s+(\d+)/giu, "$1\u00a0$2");
}

export function parseAnimeTitle(title: string) {
  const trimmed = title.trim();
  const split = trimmed.match(TITLE_SPLIT_RE) ?? trimmed.match(TRAILING_SEASON_RE);
  if (!split) {
    return { main: trimmed, meta: null as string | null };
  }
  return {
    main: split[1].trim(),
    meta: formatMeta(split[2].trim()),
  };
}
