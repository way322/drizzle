import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../../server/db";
import { userHiddenResume } from "../../../../../server/db/schema";
import { withAuth } from "../../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const animeId = Number(body?.animeId);

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  await db
    .insert(userHiddenResume)
    .values({
      userId: ctx.userId,
      animeId,
    })
    .onConflictDoNothing();

  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (req, ctx) => {
  const { searchParams } = new URL(req.url);
  const animeId = Number(searchParams.get("animeId"));

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  await db
    .delete(userHiddenResume)
    .where(and(eq(userHiddenResume.userId, ctx.userId), eq(userHiddenResume.animeId, animeId)));

  return NextResponse.json({ success: true });
});
