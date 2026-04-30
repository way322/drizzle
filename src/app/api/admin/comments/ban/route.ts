import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "../../../../../server/db";
import { users } from "../../../../../server/db/schema";
import { withRole } from "../../../../../server/services/userService";

const ALLOWED_DAYS = [1, 7, 14] as const;

export const POST = withRole("admin", async (req) => {
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const days = Number(body?.days);

  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  if (!ALLOWED_DAYS.includes(days as (typeof ALLOWED_DAYS)[number])) {
    return NextResponse.json({ error: "Allowed days: 1, 7, 14" }, { status: 400 });
  }

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.update(users).set({ commentBanUntil: until }).where(eq(users.id, userId));

  return NextResponse.json({ success: true, commentBanUntil: until.toISOString() });
});
