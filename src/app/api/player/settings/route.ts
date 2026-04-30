import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { animeDubbings, userPlayerSettings } from "../../../../server/db/schema";
import { withAuth } from "../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);

  const preferredDubbingIdRaw = body?.preferredDubbingId;
  const preferredDubbingId =
    preferredDubbingIdRaw === null || preferredDubbingIdRaw === undefined
      ? null
      : Number(preferredDubbingIdRaw);
  const autoSkipIntro =
    typeof body?.autoSkipIntro === "boolean" ? body.autoSkipIntro : undefined;
  const autoSkipOutro =
    typeof body?.autoSkipOutro === "boolean" ? body.autoSkipOutro : undefined;
  const autoNextEpisode =
    typeof body?.autoNextEpisode === "boolean" ? body.autoNextEpisode : undefined;

  if (preferredDubbingId !== null && !Number.isInteger(preferredDubbingId)) {
    return NextResponse.json({ error: "Invalid preferredDubbingId" }, { status: 400 });
  }

  if (preferredDubbingId !== null) {
    const exists = await db.query.animeDubbings.findFirst({
      where: eq(animeDubbings.id, preferredDubbingId),
      columns: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Dubbing not found" }, { status: 404 });
    }
  }

  const current = await db.query.userPlayerSettings.findFirst({
    where: eq(userPlayerSettings.userId, ctx.userId),
    columns: {
      autoSkipIntro: true,
      autoSkipOutro: true,
      autoNextEpisode: true,
      preferredDubbingId: true,
    },
  });

  const nextIntro = autoSkipIntro ?? current?.autoSkipIntro ?? true;
  const nextOutro = autoSkipOutro ?? current?.autoSkipOutro ?? true;
  const nextAutoNextEpisode = autoNextEpisode ?? current?.autoNextEpisode ?? false;
  const nextPreferred =
    preferredDubbingId === undefined ? (current?.preferredDubbingId ?? null) : preferredDubbingId;

  await db
    .insert(userPlayerSettings)
    .values({
      userId: ctx.userId,
      preferredDubbingId: nextPreferred,
      autoSkipIntro: nextIntro,
      autoSkipOutro: nextOutro,
      autoNextEpisode: nextAutoNextEpisode,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userPlayerSettings.userId],
      set: {
        preferredDubbingId: nextPreferred,
        autoSkipIntro: nextIntro,
        autoSkipOutro: nextOutro,
        autoNextEpisode: nextAutoNextEpisode,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ success: true });
});
