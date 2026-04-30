import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../../../../server/db";
import { anime, commentReports, comments, users } from "../../../../server/db/schema";
import { withRole } from "../../../../server/services/userService";

export const GET = withRole("admin", async () => {
  const rows = await db
    .select({
      id: comments.id,
      animeId: comments.animeId,
      animeTitle: anime.title,
      userId: comments.userId,
      username: users.username,
      content: comments.content,
      parentCommentId: comments.parentCommentId,
      createdAt: comments.createdAt,
      reportCount: sql<number>`count(${commentReports.id})::int`.as("reportCount"),
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(anime, eq(anime.id, comments.animeId))
    .innerJoin(
      commentReports,
      and(eq(commentReports.commentId, comments.id), eq(commentReports.status, "open"))
    )
    .where(eq(comments.isDeleted, false))
    .groupBy(comments.id, anime.id, users.id)
    .orderBy(desc(sql<number>`count(${commentReports.id})`), desc(comments.createdAt))
    .limit(250);

  return NextResponse.json({ items: rows });
});

export const DELETE = withRole("admin", async (req, ctx) => {
  const { searchParams } = new URL(req.url);
  const commentId = Number(searchParams.get("commentId"));

  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  const existing = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.isDeleted, false)),
    columns: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  await db.update(comments).set({ isDeleted: true }).where(eq(comments.id, commentId));
  await db
    .update(commentReports)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      handledByUserId: ctx.userId,
    })
    .where(and(eq(commentReports.commentId, commentId), eq(commentReports.status, "open")));

  return NextResponse.json({ success: true });
});
