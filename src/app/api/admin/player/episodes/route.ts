import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { db } from "../../../../../server/db";
import { animeDubbings, animeEpisodes } from "../../../../../server/db/schema";
import { withRole } from "../../../../../server/services/userService";
import { parseStreamVariants, type StreamVariantsMap } from "../../../../../lib/videoQuality";
import {
  buildClientS3Url,
  deleteS3Object,
  extractObjectKeyFromS3Url,
  getS3Bucket,
  getS3Client,
} from "../../../../../lib/s3";
import { buildEpisodeObjectKey } from "../../../../../lib/s3ObjectKey";
import { transcodeEpisodeVariants } from "../../../../../server/services/videoTranscode";

function parseTimeOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    return Math.max(0, Number.parseInt(raw, 10));
  }

  const colonParts = raw.split(":").map((x) => x.trim());
  if (colonParts.length === 2 && colonParts.every((x) => /^\d+$/.test(x))) {
    const minutes = Number.parseInt(colonParts[0], 10);
    const seconds = Number.parseInt(colonParts[1], 10);
    if (seconds >= 60) return null;
    return Math.max(0, minutes * 60 + seconds);
  }

  const spaceParts = raw.split(/\s+/g).filter(Boolean);
  if (spaceParts.length === 2 && spaceParts.every((x) => /^\d+$/.test(x))) {
    const minutes = Number.parseInt(spaceParts[0], 10);
    const seconds = Number.parseInt(spaceParts[1], 10);
    if (seconds >= 60) return null;
    return Math.max(0, minutes * 60 + seconds);
  }

  return null;
}

export const POST = withRole("admin", async (req) => {
  const body = await req.json().catch(() => null);

  const animeId = Number(body?.animeId);
  const dubbingId = Number(body?.dubbingId);
  const episodeNumber = Number(body?.episodeNumber);
  const title = String(body?.title ?? "").trim() || null;
  const objectKey = String(body?.objectKey ?? "").trim();
  const streamUrlRaw = String(body?.streamUrl ?? "").trim();

  if (!Number.isInteger(animeId) || !Number.isInteger(dubbingId) || !Number.isInteger(episodeNumber)) {
    return NextResponse.json({ error: "animeId, dubbingId, episodeNumber are required" }, { status: 400 });
  }
  const dubbing = await db.query.animeDubbings.findFirst({
    where: and(eq(animeDubbings.id, dubbingId), eq(animeDubbings.animeId, animeId)),
    columns: { id: true },
  });
  if (!dubbing) {
    return NextResponse.json({ error: "Dubbing not found for this anime" }, { status: 404 });
  }

  const introStartSec = parseTimeOrNull(body?.introStartSec);
  const introEndSec = parseTimeOrNull(body?.introEndSec);
  const outroStartSec = parseTimeOrNull(body?.outroStartSec);
  const outroEndSec = parseTimeOrNull(body?.outroEndSec);
  const durationSec = parseTimeOrNull(body?.durationSec);

  const resolvedObjectKey =
    objectKey ||
    (streamUrlRaw ? extractObjectKeyFromS3Url(streamUrlRaw) : "") ||
    buildEpisodeObjectKey({ animeId, dubbingId, episodeNumber, title });
  const streamUrl = streamUrlRaw || buildClientS3Url(resolvedObjectKey);

  const existingEpisode = await db.query.animeEpisodes.findFirst({
    where: and(
      eq(animeEpisodes.animeId, animeId),
      eq(animeEpisodes.dubbingId, dubbingId),
      eq(animeEpisodes.episodeNumber, episodeNumber)
    ),
    columns: { id: true, objectKey: true, streamVariants: true },
  });

  const bucket = getS3Bucket();
  const s3 = getS3Client();
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: resolvedObjectKey,
      })
    );
  } catch {
    return NextResponse.json(
      {
        error: `Файл не найден в S3 по пути «${resolvedObjectKey}». Сначала загрузи файл через блок «Загрузка видео в S3» и дождись сообщения «Видео загружено в S3», затем сохраняй серию.`,
      },
      { status: 400 }
    );
  }

  const sourceChanged = existingEpisode?.objectKey?.trim() !== resolvedObjectKey;

  await db
    .insert(animeEpisodes)
    .values({
      animeId,
      dubbingId,
      episodeNumber,
      title,
      objectKey: resolvedObjectKey,
      streamUrl,
      streamVariants: null,
      introStartSec,
      introEndSec,
      outroStartSec,
      outroEndSec,
      durationSec,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [animeEpisodes.animeId, animeEpisodes.dubbingId, animeEpisodes.episodeNumber],
      set: {
        title,
        objectKey: resolvedObjectKey,
        streamUrl,
        ...(sourceChanged ? { streamVariants: null } : {}),
        introStartSec,
        introEndSec,
        outroStartSec,
        outroEndSec,
        durationSec,
        updatedAt: new Date(),
      },
    });

  const oldObjectKey = existingEpisode?.objectKey?.trim();
  if (oldObjectKey && oldObjectKey !== resolvedObjectKey) {
    await deleteS3Object(oldObjectKey).catch(() => null);
    let oldVariants: StreamVariantsMap = {};
    if (existingEpisode?.streamVariants) {
      try {
        oldVariants = parseStreamVariants(JSON.parse(existingEpisode.streamVariants));
      } catch {
        oldVariants = {};
      }
    }
    await Promise.all(
      Object.values(oldVariants)
        .filter((key): key is string => Boolean(key?.trim()))
        .map((key) => deleteS3Object(key).catch(() => null))
    );
  }

  const savedEpisode = await db.query.animeEpisodes.findFirst({
    where: and(
      eq(animeEpisodes.animeId, animeId),
      eq(animeEpisodes.dubbingId, dubbingId),
      eq(animeEpisodes.episodeNumber, episodeNumber)
    ),
    columns: { id: true },
  });

  if (savedEpisode?.id) {
    void transcodeEpisodeVariants(savedEpisode.id).catch((err) => {
      console.error("Background transcode failed:", err);
    });
  }

  return NextResponse.json({
    success: true,
    episodeId: savedEpisode?.id ?? null,
    transcodeQueued: Boolean(savedEpisode?.id),
  });
});

export const DELETE = withRole("admin", async (req) => {
  const { searchParams } = new URL(req.url);
  const episodeId = Number(searchParams.get("episodeId"));

  if (!Number.isInteger(episodeId)) {
    return NextResponse.json({ error: "Invalid episodeId" }, { status: 400 });
  }

  const episode = await db.query.animeEpisodes.findFirst({
    where: eq(animeEpisodes.id, episodeId),
    columns: { id: true, objectKey: true, streamVariants: true },
  });
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  await db.delete(animeEpisodes).where(eq(animeEpisodes.id, episodeId));
  if (episode.objectKey?.trim()) {
    await deleteS3Object(episode.objectKey).catch(() => null);
  }
  let variants: StreamVariantsMap = {};
  if (episode.streamVariants) {
    try {
      variants = parseStreamVariants(JSON.parse(episode.streamVariants));
    } catch {
      variants = {};
    }
  }
  await Promise.all(
    Object.values(variants)
      .filter((key): key is string => Boolean(key?.trim() && key !== episode.objectKey))
      .map((key) => deleteS3Object(key).catch(() => null))
  );

  return NextResponse.json({ success: true });
});
