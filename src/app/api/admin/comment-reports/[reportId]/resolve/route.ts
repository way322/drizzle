import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../../../../../../server/db";
import { commentReports, comments } from "../../../../../../server/db/schema";
import { withRole } from "../../../../../../server/services/userService";

type RouteParams = {
  params: Promise<{ reportId: string }>;
};

export const POST = withRole<RouteParams>("admin", async (_req, ctx, routeCtx) => {
  const { reportId } = await (routeCtx?.params ?? Promise.resolve({ reportId: "" }));
  const id = Number(reportId);

  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid reportId" }, { status: 400 });
  }

  const report = await db.query.commentReports.findFirst({
    where: and(eq(commentReports.id, id), eq(commentReports.status, "open")),
    columns: { id: true, commentId: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Жалоба не найдена" }, { status: 404 });
  }

  await db.update(comments).set({ isDeleted: true }).where(eq(comments.id, report.commentId));

  await db
    .update(commentReports)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      handledByUserId: ctx.userId,
    })
    .where(eq(commentReports.commentId, report.commentId));

  return NextResponse.json({ success: true });
});
