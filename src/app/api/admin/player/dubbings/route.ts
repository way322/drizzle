import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";

import { db } from "../../../../../server/db";
import { anime, animeDubbings } from "../../../../../server/db/schema";
import { withRole } from "../../../../../server/services/userService";

export const POST = withRole("admin", async (req) => {
  const body = await req.json().catch(() => null);
  const animeId = Number(body?.animeId);
  const title = String(body?.title ?? "").trim();
  const language = String(body?.language ?? "ru").trim().slice(0, 20) || "ru";
  const sortOrder = Number.isInteger(body?.sortOrder) ? Number(body.sortOrder) : 0;
  const isDefault = Boolean(body?.isDefault);

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Dubbing title is required" }, { status: 400 });
  }

  const animeItem = await db.query.anime.findFirst({
    where: eq(anime.id, animeId),
    columns: { id: true },
  });
  if (!animeItem) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  const [created] = await db
    .insert(animeDubbings)
    .values({
      animeId,
      title,
      language,
      sortOrder,
      isDefault,
      createdAt: new Date(),
    })
    .returning({
      id: animeDubbings.id,
      title: animeDubbings.title,
      language: animeDubbings.language,
      sortOrder: animeDubbings.sortOrder,
      isDefault: animeDubbings.isDefault,
    });

  if (isDefault) {
    await db
      .update(animeDubbings)
      .set({ isDefault: false })
      .where(and(eq(animeDubbings.animeId, animeId), ne(animeDubbings.id, created.id)));
    await db
      .update(animeDubbings)
      .set({ isDefault: true })
      .where(eq(animeDubbings.id, created.id));
  }

  return NextResponse.json({ item: created });
});
