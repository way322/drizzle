import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { commentReports, comments } from "../../../../server/db/schema";
import { sanitizeCommentText } from "../../../../lib/profanity";
import { withAuth } from "../../../../server/services/userService";

type RouteCtx = { params: Promise<{ commentId: string }> };

export const PATCH = withAuth<RouteCtx>(async (req, ctx, routeCtx) => {
  const params = routeCtx ? await routeCtx.params : null;
  const commentId = Number.parseInt(params?.commentId ?? "", 10);
  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();

  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "Комментарий пустой" }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: "Комментарий слишком длинный" }, { status: 400 });
  }

  const row = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.isDeleted, false)),
    columns: { id: true, userId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  if (row.userId !== ctx.userId) {
    return NextResponse.json({ error: "Можно редактировать только свой комментарий" }, { status: 403 });
  }

  await db
    .update(comments)
    .set({ content: sanitizeCommentText(content), updatedAt: new Date() })
    .where(eq(comments.id, commentId));

  return NextResponse.json({ success: true });
});

export const DELETE = withAuth<RouteCtx>(async (_req, ctx, routeCtx) => {
  const params = routeCtx ? await routeCtx.params : null;
  const commentId = Number.parseInt(params?.commentId ?? "", 10);

  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  const row = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), eq(comments.isDeleted, false)),
    columns: { id: true, userId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Комментарий не найден" }, { status: 404 });
  }

  const canDelete = row.userId === ctx.userId || ctx.role === "admin";
  if (!canDelete) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
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
