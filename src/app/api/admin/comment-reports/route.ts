import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { anime, commentReports, comments, users } from "../../../../server/db/schema";
import { withRole } from "../../../../server/services/userService";

export const GET = withRole("admin", async () => {
  const rows = await db
    .select({
      reportId: commentReports.id,
      reportCreatedAt: commentReports.createdAt,
      reason: commentReports.reason,
      status: commentReports.status,
      commentId: comments.id,
      commentContent: comments.content,
      commentCreatedAt: comments.createdAt,
      animeId: anime.id,
      animeTitle: anime.title,
      reporterId: commentReports.reporterId,
      reporterName: users.username,
    })
    .from(commentReports)
    .innerJoin(comments, eq(commentReports.commentId, comments.id))
    .innerJoin(anime, eq(comments.animeId, anime.id))
    .innerJoin(users, eq(commentReports.reporterId, users.id))
    .where(and(eq(commentReports.status, "open"), eq(comments.isDeleted, false)))
    .orderBy(desc(commentReports.createdAt));

  return NextResponse.json({ items: rows });
});
