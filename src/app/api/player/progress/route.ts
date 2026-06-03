import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { animeEpisodes, userAnimeProgress, userHiddenResume } from "../../../../server/db/schema";
import { withAuth } from "../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const animeId = Number(body?.animeId);
  const episodeId = Number(body?.episodeId);
  const progressSecRaw = Number(body?.progressSec);
  const progressSec = Number.isFinite(progressSecRaw) ? Math.max(0, Math.floor(progressSecRaw)) : 0;
  const progressDurationSecRaw = Number(body?.progressDurationSec);
  const progressDurationSec = Number.isFinite(progressDurationSecRaw)
    ? Math.max(1, Math.floor(progressDurationSecRaw))
    : null;

  if (!Number.isInteger(animeId) || !Number.isInteger(episodeId)) {
    return NextResponse.json({ error: "animeId and episodeId are required" }, { status: 400 });
  }

  const episode = await db.query.animeEpisodes.findFirst({
    where: and(eq(animeEpisodes.id, episodeId), eq(animeEpisodes.animeId, animeId)),
    columns: { id: true },
  });
  if (!episode) {
    return NextResponse.json({ error: "Episode not found for anime" }, { status: 404 });
  }

  await db
    .delete(userHiddenResume)
    .where(and(eq(userHiddenResume.userId, ctx.userId), eq(userHiddenResume.animeId, animeId)));

  await db
    .insert(userAnimeProgress)
    .values({
      userId: ctx.userId,
      animeId,
      episodeId,
      progressSec,
      progressDurationSec,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userAnimeProgress.userId, userAnimeProgress.animeId],
      set: { episodeId, progressSec, progressDurationSec, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true });
});
