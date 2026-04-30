import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { db } from "../../../../../server/db";
import { anime, animeDubbings, animeEpisodes } from "../../../../../server/db/schema";
import { withRole } from "../../../../../server/services/userService";

export const GET = withRole("admin", async (req) => {
  const { searchParams } = new URL(req.url);
  const animeId = Number(searchParams.get("animeId"));

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  const item = await db.query.anime.findFirst({
    where: eq(anime.id, animeId),
    columns: { id: true, title: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
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
      streamUrl: animeEpisodes.streamUrl,
      objectKey: animeEpisodes.objectKey,
      introStartSec: animeEpisodes.introStartSec,
      introEndSec: animeEpisodes.introEndSec,
      outroStartSec: animeEpisodes.outroStartSec,
      outroEndSec: animeEpisodes.outroEndSec,
      durationSec: animeEpisodes.durationSec,
    })
    .from(animeEpisodes)
    .where(eq(animeEpisodes.animeId, animeId))
    .orderBy(asc(animeEpisodes.episodeNumber), asc(animeEpisodes.id));

  return NextResponse.json({
    anime: item,
    dubbings,
    episodes,
  });
});
