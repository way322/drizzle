export function sanitizeS3FileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function slugifyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildEpisodeObjectKey(params: {
  animeId: number;
  dubbingId: number;
  episodeNumber: number;
  fileName?: string | null;
  title?: string | null;
}) {
  const stamp = Date.now();
  const customFileName = params.fileName?.trim();
  if (customFileName) {
    return `anime/${params.animeId}/dubbing/${params.dubbingId}/episode-${params.episodeNumber}/${stamp}-${sanitizeS3FileName(customFileName)}`;
  }

  const titlePart = params.title?.trim() ? slugifyPart(params.title.trim()) : "";
  const fileName = titlePart
    ? `episode-${params.episodeNumber}-${titlePart}.mp4`
    : `episode-${params.episodeNumber}.mp4`;
  return `anime/${params.animeId}/dubbing/${params.dubbingId}/episode-${params.episodeNumber}/${stamp}-${fileName}`;
}
