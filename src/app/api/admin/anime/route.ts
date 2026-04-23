// src/app/api/admin/anime/route.ts
import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { anime, animeGenres, animeImages, genres, ratings } from "../../../../server/db/schema";
import { and, desc, eq, sql, or, inArray } from "drizzle-orm";
import { withRole } from "../../../../server/services/userService";

type Body = {
  title?: string;
  description?: string | null;
  releaseYear?: number | null;
  status?: string | null;
  externalUrl?: string;
  posterUrl?: string | null;
  genres?: string[];
};

const ADMIN_STATUSES = ["ongoing", "completed", "hiatus"] as const;

function normalizeGenreNames(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const names = list
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);
  return Array.from(new Set(names));
}

function parseIdQuery(q: string): number | null {
  const s = q.trim();
  if (!s) return null;

  const compactHash = s.match(/^#(\d+)$/);
  if (compactHash) {
    const n = Number.parseInt(compactHash[1], 10);
    return Number.isSafeInteger(n) ? n : null;
  }

  const compactId = s.match(/^id(\d+)$/i);
  if (compactId) {
    const n = Number.parseInt(compactId[1], 10);
    return Number.isSafeInteger(n) ? n : null;
  }

  const spaced = s.match(/^\s*(?:id|#)\s*[: ]\s*(\d+)\s*$/i);
  if (spaced) {
    const n = Number.parseInt(spaced[1], 10);
    return Number.isSafeInteger(n) ? n : null;
  }

  return null;
}

export const GET = withRole("admin", async (req) => {
  const { searchParams } = new URL(req.url);

  const qRaw = (searchParams.get("q") ?? "").trim();
  const q = qRaw.slice(0, 80);

  const statusRaw = (searchParams.get("status") ?? "").trim();
  const status = ADMIN_STATUSES.includes(statusRaw as any) ? statusRaw : "";

  const limitRaw = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  const whereParts: any[] = [];

  const idFromQuery = q ? parseIdQuery(q) : null;

  if (idFromQuery != null) {
    whereParts.push(eq(anime.id, idFromQuery));
  } else if (q) {
    const pattern = `%${q}%`;
    whereParts.push(
      or(
        sql<boolean>`${anime.title} ilike ${pattern}`,
        sql<boolean>`coalesce(${anime.description}, '') ilike ${pattern}`
      )
    );
  }

  if (status) whereParts.push(eq(anime.status, status as any));

  const where = whereParts.length ? and(...whereParts) : undefined;

  const ratingAgg = db
    .select({
      animeId: ratings.animeId,
      avgRating: sql<number>`coalesce(avg(${ratings.value}), 0)::float`.as("avg_rating"),
      ratingsCount: sql<number>`count(${ratings.id})::int`.as("ratings_count"),
    })
    .from(ratings)
    .groupBy(ratings.animeId)
    .as("ra");

  const genreAgg = db
    .select({
      animeId: animeGenres.animeId,
      genres: sql<string[]>`coalesce(array_agg(distinct ${genres.name}), array[]::text[])`.as("genres"),
    })
    .from(animeGenres)
    .innerJoin(genres, eq(animeGenres.genreId, genres.id))
    .groupBy(animeGenres.animeId)
    .as("ga");

  const ratingVal = sql<number>`coalesce(${(ratingAgg as any).avgRating}, 0)`;
  const genresVal = sql<string[]>`coalesce(${(genreAgg as any).genres}, array[]::text[])`;

  let query = db
    .select({
      id: anime.id,
      title: anime.title,
      description: anime.description,
      releaseYear: anime.releaseYear,
      status: anime.status,
      rating: ratingVal.as("rating"),
      externalUrl: anime.externalUrl,
      posterUrl: animeImages.imageUrl,
      genres: genresVal.as("genres"),
    })
    .from(anime)
    .leftJoin(ratingAgg, eq((ratingAgg as any).animeId, anime.id))
    .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
    .leftJoin(genreAgg, eq((genreAgg as any).animeId, anime.id))
    .orderBy(desc(anime.createdAt))
    .limit(limit);

  if (where) query = (query as any).where(where);

  const items = await query;
  return NextResponse.json({ items });
});

export const POST = withRole("admin", async (req) => {
  const body = (await req.json()) as Body;

  const title = (body.title ?? "").trim();
  const externalUrl = (body.externalUrl ?? "").trim();

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!externalUrl) return NextResponse.json({ error: "externalUrl is required" }, { status: 400 });

  const genreNames = normalizeGenreNames(body.genres);

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(anime)
      .values({
        title,
        description: body.description ?? null,
        releaseYear: body.releaseYear ?? null,
        status: (body.status ?? "ongoing") as any,
        externalUrl,
      })
      .returning({ id: anime.id });

    const posterUrl = (body.posterUrl ?? "").trim();
    if (posterUrl) {
      await tx.insert(animeImages).values({
        animeId: row.id,
        imageUrl: posterUrl,
        isPoster: true,
      });
    }

    if (genreNames.length) {
      await tx
        .insert(genres)
        .values(genreNames.map((name) => ({ name })))
        .onConflictDoNothing();

      const rows = await tx
        .select({ id: genres.id, name: genres.name })
        .from(genres)
        .where(inArray(genres.name, genreNames));

      await tx.insert(animeGenres).values(
        rows.map((g) => ({
          animeId: row.id,
          genreId: g.id,
        }))
      );
    }

    return row;
  });

  return NextResponse.json({ ok: true, id: created.id });
});