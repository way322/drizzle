import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { comments, commentVotes } from "../../../../server/db/schema";
import { withAuth } from "../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const commentId = Number(body?.commentId);
  const value = Number(body?.value);

  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  if (value !== -1 && value !== 0 && value !== 1) {
    return NextResponse.json({ error: "Invalid vote value" }, { status: 400 });
  }

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.isDeleted, false)),
    columns: { id: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  if (value === 0) {
    await db
      .delete(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, ctx.userId)));
    return NextResponse.json({ success: true });
  }

  await db
    .insert(commentVotes)
    .values({
      commentId,
      userId: ctx.userId,
      value,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [commentVotes.commentId, commentVotes.userId],
      set: { value, updatedAt: new Date() },
    });

  return NextResponse.json({ success: true });
});
