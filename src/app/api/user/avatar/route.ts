import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "../../../../server/db";
import { users } from "../../../../server/db/schema";
import { withAuth } from "../../../../server/services/userService";

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const avatarUrl = String(body?.avatarUrl ?? "").trim();

  if (!avatarUrl) {
    return NextResponse.json({ error: "avatarUrl is required" }, { status: 400 });
  }

  await db.update(users).set({ avatarUrl }).where(eq(users.id, ctx.userId));
  return NextResponse.json({ success: true, avatarUrl });
});
