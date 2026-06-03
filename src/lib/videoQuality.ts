export const QUALITY_IDS = ["1080", "720", "480"] as const;
export type QualityId = (typeof QUALITY_IDS)[number];
export type PreferredQuality = QualityId | "auto";

export type StreamVariantsMap = Partial<Record<QualityId, string>>;

export type EpisodeQualityOption = {
  id: QualityId;
  label: string;
  height: number;
  streamUrl: string;
};

const QUALITY_META: Record<QualityId, { label: string; height: number }> = {
  "1080": { label: "1080p", height: 1080 },
  "720": { label: "720p", height: 720 },
  "480": { label: "480p", height: 480 },
};

export function parseStreamVariants(raw: unknown): StreamVariantsMap {
  if (!raw || typeof raw !== "object") return {};
  const out: StreamVariantsMap = {};
  for (const id of QUALITY_IDS) {
    const key = (raw as Record<string, unknown>)[id];
    if (typeof key === "string" && key.trim()) out[id] = key.trim();
  }
  return out;
}

export function buildQualityObjectKey(sourceKey: string, quality: QualityId) {
  const normalized = sourceKey.replace(/^\/+/, "");
  if (quality === "1080") return normalized;

  const slash = normalized.lastIndexOf("/");
  const dir = slash >= 0 ? normalized.slice(0, slash) : "";
  const file = slash >= 0 ? normalized.slice(slash + 1) : normalized;
  const targetDir = dir ? `${dir}/qualities/${quality}p` : `qualities/${quality}p`;
  return `${targetDir}/${file}`;
}

export function pickAutoQuality(
  options: EpisodeQualityOption[],
  network?: {
    effectiveType?: string;
    downlinkMbps?: number;
    saveData?: boolean;
  }
): QualityId {
  const available = new Set(options.map((o) => o.id));
  const fallback =
    (available.has("1080") && "1080") ||
    (available.has("720") && "720") ||
    (available.has("480") && "480") ||
    options[0]?.id ||
    "1080";

  if (network?.saveData) {
    if (available.has("480")) return "480";
    if (available.has("720")) return "720";
    return fallback;
  }

  const type = (network?.effectiveType ?? "").toLowerCase();
  const downlink = network?.downlinkMbps ?? null;

  if (type === "slow-2g" || type === "2g" || (downlink !== null && downlink < 1.5)) {
    if (available.has("480")) return "480";
    if (available.has("720")) return "720";
    return fallback;
  }

  if (type === "3g" || (downlink !== null && downlink < 4)) {
    if (available.has("720")) return "720";
    if (available.has("480")) return "480";
    return fallback;
  }

  if (available.has("1080")) return "1080";
  if (available.has("720")) return "720";
  return fallback;
}

export function buildEpisodeQualityOptions(params: {
  sourceObjectKey: string;
  sourceStreamUrl: string;
  variants: StreamVariantsMap;
  resolveUrl: (objectKey: string) => string;
}): EpisodeQualityOption[] {
  const keys: StreamVariantsMap = {
    "1080": params.variants["1080"] ?? params.sourceObjectKey,
    "720": params.variants["720"],
    "480": params.variants["480"],
  };

  const options: EpisodeQualityOption[] = [];
  for (const id of QUALITY_IDS) {
    const objectKey = keys[id];
    if (!objectKey) continue;
    const meta = QUALITY_META[id];
    options.push({
      id,
      label: meta.label,
      height: meta.height,
      streamUrl:
        id === "1080" && !params.variants["1080"]
          ? params.sourceStreamUrl
          : params.resolveUrl(objectKey),
    });
  }

  return options;
}

export function isPreferredQuality(value: unknown): value is PreferredQuality {
  return value === "auto" || QUALITY_IDS.includes(value as QualityId);
}
