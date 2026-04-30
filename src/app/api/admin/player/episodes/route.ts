import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import { db } from "../../../../../server/db";
import { animeDubbings, animeEpisodes } from "../../../../../server/db/schema";
import { withRole } from "../../../../../server/services/userService";
import { buildClientS3Url, getPublicS3BaseUrl, getS3Bucket, getS3Client } from "../../../../../lib/s3";

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

function slugifyPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generateObjectKey(params: {
  animeId: number;
  dubbingId: number;
  episodeNumber: number;
  title: string | null;
}) {
  const titlePart = params.title ? slugifyPart(params.title) : "";
  const stamp = Date.now();
  const fileName = titlePart
    ? `episode-${params.episodeNumber}-${titlePart}.mp4`
    : `episode-${params.episodeNumber}.mp4`;
  return `anime/${params.animeId}/dubbing/${params.dubbingId}/episode-${params.episodeNumber}/${stamp}-${fileName}`;
}

function extractObjectKeyFromStreamUrl(streamUrl: string) {
  const publicBase = getPublicS3BaseUrl();
  if (streamUrl.startsWith(`${publicBase}/`)) {
    return streamUrl.slice(publicBase.length + 1);
  }
  return streamUrl.replace(/^https?:\/\/[^/]+\/[^/]+\//i, "");
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
    (streamUrlRaw ? extractObjectKeyFromStreamUrl(streamUrlRaw) : "") ||
    generateObjectKey({ animeId, dubbingId, episodeNumber, title });
  const streamUrl = streamUrlRaw || buildClientS3Url(resolvedObjectKey);

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
        error:
          "Файл не найден в S3 по этому пути. Сначала загрузи файл через блок 'Загрузка видео в S3', затем сохраняй серию.",
      },
      { status: 400 }
    );
  }

  await db
    .insert(animeEpisodes)
    .values({
      animeId,
      dubbingId,
      episodeNumber,
      title,
      objectKey: resolvedObjectKey,
      streamUrl,
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
        introStartSec,
        introEndSec,
        outroStartSec,
        outroEndSec,
        durationSec,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
});

export const DELETE = withRole("admin", async (req) => {
  const { searchParams } = new URL(req.url);
  const episodeId = Number(searchParams.get("episodeId"));

  if (!Number.isInteger(episodeId)) {
    return NextResponse.json({ error: "Invalid episodeId" }, { status: 400 });
  }

  await db.delete(animeEpisodes).where(eq(animeEpisodes.id, episodeId));
  return NextResponse.json({ success: true });
});
