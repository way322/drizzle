// src/app/api/user/loved/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { anime, animeImages, favorites, ratings, userAnimeStatus } from "../../../../server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { withAuth } from "../../../../server/services/userService";

export const GET = withAuth(async (req, ctx) => {
    const userId = ctx.userId;
    const { searchParams } = new URL(req.url);

    const animeIdRaw = searchParams.get("animeId");

    if (animeIdRaw != null) {
        const animeId = Number(animeIdRaw);
        if (!Number.isInteger(animeId)) {
            return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
        }

        const row = await db.query.favorites.findFirst({
            where: and(eq(favorites.userId, userId), eq(favorites.animeId, animeId)),
        });

        return NextResponse.json({ loved: Boolean(row) });
    }

    const rows = await db
        .select({
            animeId: anime.id,
            title: anime.title,
            releaseYear: anime.releaseYear,
            description: anime.description,
            posterUrl: animeImages.imageUrl,
            status: userAnimeStatus.status,
            userRating: ratings.value,
            loved: sql<boolean>`true`.as("loved"),
            lovedCreatedAt: favorites.createdAt,
        })
        .from(favorites)
        .innerJoin(anime, eq(favorites.animeId, anime.id))
        .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
        .leftJoin(
            userAnimeStatus,
            and(eq(userAnimeStatus.animeId, anime.id), eq(userAnimeStatus.userId, userId))
        )
        .leftJoin(ratings, and(eq(ratings.animeId, anime.id), eq(ratings.userId, userId)))
        .where(eq(favorites.userId, userId))
        .orderBy(desc(favorites.createdAt));

    return NextResponse.json({ items: rows });
});

export const POST = withAuth(async (req, ctx) => {
    const userId = ctx.userId;

    const body = await req.json().catch(() => null);
    const animeId = Number(body?.animeId);
    const loved = Boolean(body?.loved);

    if (!Number.isInteger(animeId)) {
        return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
    }

    if (!loved) {
        await db
            .delete(favorites)
            .where(and(eq(favorites.userId, userId), eq(favorites.animeId, animeId)));

        return NextResponse.json({ success: true, loved: false });
    }

    await db
        .insert(favorites)
        .values({
            userId,
            animeId,
            createdAt: new Date(),
        })
        .onConflictDoNothing();

    return NextResponse.json({ success: true, loved: true });
});