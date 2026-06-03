// src/app/api/admin/genres/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { genres } from "../../../../server/db/schema";
import { asc, eq } from "drizzle-orm";
import { filterVisibleGenres, isBlockedGenre } from "@/lib/genreFilters";
import { withRole } from "../../../../server/services/userService";

export const GET = withRole("admin", async () => {
  const rows = await db.select({ id: genres.id, name: genres.name }).from(genres).orderBy(asc(genres.name));
  return NextResponse.json({ items: filterVisibleGenres(rows) });
});

export const POST = withRole("admin", async (req) => {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (name.length > 50) return NextResponse.json({ error: "name is too long" }, { status: 400 });

  if (isBlockedGenre(name)) {
    return NextResponse.json({ error: "Этот жанр нельзя добавить" }, { status: 400 });
  }
  await db.insert(genres).values({ name }).onConflictDoNothing();
  const row = await db.query.genres.findFirst({ where: eq(genres.name, name) });
  return NextResponse.json({ ok: true, item: row ? { id: row.id, name: row.name } : null });
});