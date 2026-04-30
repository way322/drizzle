import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { commentReports, comments } from "../../../../server/db/schema";
import { withAuth } from "../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const commentId = Number(body?.commentId);
  const reason = String(body?.reason ?? "").trim();

  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.isDeleted, false)),
    columns: { id: true, userId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  if (comment.userId === ctx.userId) {
    return NextResponse.json({ error: "Нельзя жаловаться на свой комментарий" }, { status: 400 });
  }

  await db
    .insert(commentReports)
    .values({
      commentId,
      reporterId: ctx.userId,
      reason: reason || null,
      status: "open",
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [commentReports.commentId, commentReports.reporterId],
      set: { reason: reason || null, status: "open", resolvedAt: null, handledByUserId: null },
    });

  return NextResponse.json({ success: true });
});
