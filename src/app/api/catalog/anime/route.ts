// src/app/api/catalog/anime/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { anime, animeGenres, animeImages, genres, ratings } from "../../../../server/db/schema";
import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

type SortKey = "new" | "rating" | "year";
type StatusKey = "all" | "ongoing" | "completed" | "hiatus";
type RatingOrder = "desc" | "asc";
type YearOrder = "desc" | "asc";
const STATUS_VALUES: readonly StatusKey[] = ["all", "ongoing", "completed", "hiatus"];
const SORT_VALUES: readonly SortKey[] = ["new", "rating", "year"];
const ORDER_VALUES: readonly RatingOrder[] = ["desc", "asc"];

function toInt(s: string | null, def: number) {
    const n = Number.parseInt(String(s ?? ""), 10);
    return Number.isFinite(n) ? n : def;
}

function parseGenresParam(raw: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 30);
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    const statusRaw = searchParams.get("status") ?? "all";
    const sortRaw = searchParams.get("sort") ?? "new";
    const ratingOrderRaw = searchParams.get("ratingOrder") ?? "desc";
    const status: StatusKey = STATUS_VALUES.includes(statusRaw as StatusKey)
        ? (statusRaw as StatusKey)
        : "all";
    const sort: SortKey = SORT_VALUES.includes(sortRaw as SortKey)
        ? (sortRaw as SortKey)
        : "new";
    const ratingOrder: RatingOrder = ORDER_VALUES.includes(ratingOrderRaw as RatingOrder)
        ? (ratingOrderRaw as RatingOrder)
        : "desc";
    const yearOrderRaw = searchParams.get("yearOrder") ?? "desc";
    const yearOrder: YearOrder = yearOrderRaw === "asc" ? "asc" : "desc";

    const yearFromRaw = searchParams.get("yearFrom");
    const yearToRaw = searchParams.get("yearTo");
    const yearFrom = yearFromRaw ? toInt(yearFromRaw, 0) : null;
    const yearTo = yearToRaw ? toInt(yearToRaw, 0) : null;

    const selectedGenres = parseGenresParam(searchParams.get("genres"));

    const offset = Math.max(0, toInt(searchParams.get("offset"), 0));
    const limit = Math.min(50, Math.max(6, toInt(searchParams.get("limit"), 20)));

    const ratingAgg = db
        .select({
            animeId: ratings.animeId,
            avgRating: sql<number>`coalesce(avg(${ratings.value}), 0)::float`.as("avg_rating"),
            ratingsCount: sql<number>`count(${ratings.id})::int`.as("ratings_count"),
        })
        .from(ratings)
        .groupBy(ratings.animeId)
        .as("ra");
    const ratingAggCols = ratingAgg as unknown as {
        animeId: typeof ratings.animeId;
        avgRating: SQL<number>;
        ratingsCount: SQL<number>;
    };

    const whereParts: SQL<unknown>[] = [];

    if (status !== "all") whereParts.push(eq(anime.status, status));
    if (yearFrom != null) whereParts.push(gte(anime.releaseYear, yearFrom));
    if (yearTo != null) whereParts.push(lte(anime.releaseYear, yearTo));

    if (selectedGenres.length) {
        whereParts.push(
            sql<boolean>`
        exists (
          select 1
          from ${animeGenres}
          join ${genres} on ${genres.id} = ${animeGenres.genreId}
          where ${animeGenres.animeId} = ${anime.id}
            and ${inArray(genres.name, selectedGenres)}
        )
      `
        );
    }

    const where = whereParts.length ? and(...whereParts) : undefined;

    const ratingVal = sql<number>`coalesce(${ratingAggCols.avgRating}, 0)`;
    const ratingsCountVal = sql<number>`coalesce(${ratingAggCols.ratingsCount}, 0)`;

    let orderBy: SQL<unknown>[] = [desc(anime.createdAt)];
    if (sort === "rating") {
        orderBy =
            ratingOrder === "asc"
                ? [asc(ratingVal), desc(ratingsCountVal), desc(anime.createdAt)]
                : [desc(ratingVal), desc(ratingsCountVal), desc(anime.createdAt)];
    } else if (sort === "year") {
        const nullYear = yearOrder === "asc" ? 9999 : 0;
        const yearSortExpr = sql<number>`coalesce(${anime.releaseYear}, ${nullYear})`;

        orderBy =
            yearOrder === "asc"
                ? [asc(yearSortExpr), desc(anime.createdAt)]
                : [desc(yearSortExpr), desc(anime.createdAt)];
    } else {
        orderBy = [desc(anime.createdAt)];
    }

    const take = limit + 1;

    const baseQuery = db
        .select({
            id: anime.id,
            title: anime.title,
            description: anime.description,
            releaseYear: anime.releaseYear,
            status: anime.status,
            posterUrl: animeImages.imageUrl,
            rating: ratingVal.as("rating"),
            ratingsCount: ratingsCountVal.as("ratingsCount"),
        })
        .from(anime)
        .leftJoin(ratingAgg, eq(ratingAggCols.animeId, anime.id))
        .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
        .orderBy(...orderBy)
        .limit(take)
        .offset(offset);

    const query = where ? baseQuery.where(where) : baseQuery;

    const rows = await query;

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
        items,
        hasMore,
        nextOffset: offset + items.length,
    });
}