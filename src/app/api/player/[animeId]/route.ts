import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import {
  animeDubbings,
  animeEpisodes,
  userAnimeProgress,
  userPlayerSettings,
} from "../../../../server/db/schema";
import { createRequestContext, requireAuth } from "../../../../server/services/userService";
import { resolveClientAssetUrl } from "../../../../lib/s3";

type RouteCtx = { params: Promise<{ animeId: string }> };

export async function GET(_req: Request, routeCtx: RouteCtx) {
  const ctx = requireAuth(await createRequestContext());
  const params = await routeCtx.params;
  const animeId = Number.parseInt(params.animeId ?? "", 10);

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  const dubbings = await db
    .select({
      id: animeDubbings.id,
      title: animeDubbings.title,
      language: animeDubbings.language,
      sortOrder: animeDubbings.sortOrder,
      isDefault: animeDubbings.isDefault,
    })
    .from(animeDubbings)
    .where(eq(animeDubbings.animeId, animeId))
    .orderBy(asc(animeDubbings.sortOrder), asc(animeDubbings.id));

  const episodes = await db
    .select({
      id: animeEpisodes.id,
      dubbingId: animeEpisodes.dubbingId,
      episodeNumber: animeEpisodes.episodeNumber,
      title: animeEpisodes.title,
      objectKey: animeEpisodes.objectKey,
      streamUrl: animeEpisodes.streamUrl,
      introStartSec: animeEpisodes.introStartSec,
      introEndSec: animeEpisodes.introEndSec,
      outroStartSec: animeEpisodes.outroStartSec,
      outroEndSec: animeEpisodes.outroEndSec,
      durationSec: animeEpisodes.durationSec,
    })
    .from(animeEpisodes)
    .where(eq(animeEpisodes.animeId, animeId))
    .orderBy(asc(animeEpisodes.episodeNumber), asc(animeEpisodes.id));

  const settings = await db.query.userPlayerSettings.findFirst({
    where: eq(userPlayerSettings.userId, ctx.userId),
    columns: {
      preferredDubbingId: true,
      autoSkipIntro: true,
      autoSkipOutro: true,
      autoNextEpisode: true,
    },
  });

  const preferredDubbingId = settings?.preferredDubbingId ?? null;
  const effectiveDubbingId =
    (preferredDubbingId && dubbings.some((d) => d.id === preferredDubbingId) && preferredDubbingId) ||
    dubbings.find((d) => d.isDefault)?.id ||
    dubbings[0]?.id ||
    null;

  const progress = await db.query.userAnimeProgress.findFirst({
    where: and(eq(userAnimeProgress.userId, ctx.userId), eq(userAnimeProgress.animeId, animeId)),
    columns: {
      episodeId: true,
      progressSec: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    dubbings,
    episodes: episodes.map((ep) => ({
      ...ep,
      streamUrl: resolveClientAssetUrl(ep.streamUrl) ?? ep.streamUrl,
    })),
    settings: {
      preferredDubbingId: effectiveDubbingId,
      autoSkipIntro: settings?.autoSkipIntro ?? true,
      autoSkipOutro: settings?.autoSkipOutro ?? true,
      autoNextEpisode: settings?.autoNextEpisode ?? false,
    },
    progress: progress
      ? {
          episodeId: progress.episodeId,
          progressSec: progress.progressSec,
          updatedAt: progress.updatedAt,
        }
      : null,
  });
}
