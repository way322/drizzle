// src/app/api/search/anime/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { anime, animeImages, ratings } from "../../../../server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const qRaw = (searchParams.get("q") ?? "").trim();
    const q = qRaw.slice(0, 80);
    const limitRaw = Number(searchParams.get("limit") ?? "8");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 8;

    if (!q) {
        return NextResponse.json({ items: [] });
    }

    const pattern = `%${q}%`;
    const qLower = q.toLowerCase();
    const prefix = `${qLower}%`;

    const rankExpr = sql<number>`
    case
      when lower(${anime.title}) like ${prefix} then 0
      else 1
    end
  `.as("rank");

    const query = db
        .select({
            id: anime.id,
            title: anime.title,
            releaseYear: anime.releaseYear,
            status: anime.status,
            posterUrl: animeImages.imageUrl,
            rating: sql<number>`coalesce(avg(${ratings.value}), 0)::float`.as("rating"),
            ratingsCount: sql<number>`count(${ratings.id})::int`.as("ratingsCount"),
            rank: rankExpr,
        })
        .from(anime)
        .leftJoin(ratings, eq(ratings.animeId, anime.id))
        .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
        .where(
            sql<boolean>`
        (${anime.title} ilike ${pattern})
        or (coalesce(${anime.description}, '') ilike ${pattern})
      `
        )
        .groupBy(anime.id, animeImages.imageUrl)
        .orderBy(sql`"rank" asc`, desc(anime.createdAt))
        .limit(limit);

    const items = await query;

    return NextResponse.json({ items });
}