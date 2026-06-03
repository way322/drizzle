import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { db } from "../../server/db";
import {
  anime,
  animeEpisodes,
  animeImages,
  favorites,
  ratings,
  userAnimeProgress,
  userAnimeStatus,
  userHiddenResume,
} from "../../server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import ProfileClient from "./ProfileClient";
import { resolveClientAssetUrl } from "../../lib/s3";

const ALLOWED = ["watching", "planned", "dropped", "completed", "loved"] as const;
type TabKey = (typeof ALLOWED)[number];
type WatchStatus = Exclude<TabKey, "loved">;
type ProfileItem = {
  animeId: number;
  title: string;
  releaseYear: number | null;
  description: string | null;
  posterUrl: string | null;
  status: WatchStatus | null;
  userRating: number | null;
  loved: boolean;
};

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProfilePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const userId = Number.parseInt(session.user.id, 10);
  if (!Number.isSafeInteger(userId)) {
    console.error("Invalid user ID", session.user.id);
    redirect("/auth/login");
  }

  const sp = await searchParams;
  const tab: TabKey =
    sp.tab && ALLOWED.includes(sp.tab as TabKey) ? (sp.tab as TabKey) : "watching";

  const countsRows = await db
    .select({
      status: userAnimeStatus.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(userAnimeStatus)
    .where(eq(userAnimeStatus.userId, userId))
    .groupBy(userAnimeStatus.status);

  const counts = countsRows.reduce((acc, r) => {
    const key = r.status as WatchStatus;
    acc[key] = Number(r.count);
    return acc;
  }, {} as Record<string, number>);

  const [lovedCountRow] = await db
    .select({ count: sql<number>`count(*)::int`.as("count") })
    .from(favorites)
    .where(eq(favorites.userId, userId));

  counts["loved"] = Number(lovedCountRow?.count ?? 0);

  let items: ProfileItem[] = [];

  if (tab === "loved") {
    const lovedRows = await db
      .select({
        animeId: anime.id,
        title: anime.title,
        releaseYear: anime.releaseYear,
        description: anime.description,
        posterUrl: animeImages.imageUrl,
        status: userAnimeStatus.status,
        userRating: ratings.value,
        loved: sql<boolean>`true`.as("loved"),
      })
      .from(favorites)
      .innerJoin(anime, eq(favorites.animeId, anime.id))
      .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
      .leftJoin(userAnimeStatus, and(eq(userAnimeStatus.animeId, anime.id), eq(userAnimeStatus.userId, userId)))
      .leftJoin(ratings, and(eq(ratings.animeId, anime.id), eq(ratings.userId, userId)))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    items = lovedRows.map((r) => ({
      ...r,
      status: (r.status as WatchStatus | null) ?? null,
    }));
  } else {
    const statusRows = await db
      .select({
        animeId: anime.id,
        status: userAnimeStatus.status,
        title: anime.title,
        releaseYear: anime.releaseYear,
        description: anime.description,
        posterUrl: animeImages.imageUrl,
        userRating: ratings.value,
        loved: favorites.userId,
      })
      .from(userAnimeStatus)
      .innerJoin(anime, eq(userAnimeStatus.animeId, anime.id))
      .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
      .leftJoin(ratings, and(eq(ratings.animeId, anime.id), eq(ratings.userId, userId)))
      .leftJoin(favorites, and(eq(favorites.animeId, anime.id), eq(favorites.userId, userId)))
      .where(and(eq(userAnimeStatus.userId, userId), eq(userAnimeStatus.status, tab)))
      .orderBy(desc(userAnimeStatus.updatedAt));

    items = statusRows.map((r) => ({
      ...r,
      status: (r.status as WatchStatus | null) ?? null,
      loved: Boolean(r.loved),
    }));
  }

  const hiddenRows = await db
    .select({ animeId: userHiddenResume.animeId })
    .from(userHiddenResume)
    .where(eq(userHiddenResume.userId, userId));
  const hiddenAnimeIds = new Set(hiddenRows.map((r) => r.animeId));

  const progressRows = await db
    .select({
      animeId: anime.id,
      title: anime.title,
      posterUrl: animeImages.imageUrl,
      episodeNumber: animeEpisodes.episodeNumber,
      durationSec: animeEpisodes.durationSec,
      progressSec: userAnimeProgress.progressSec,
      progressDurationSec: userAnimeProgress.progressDurationSec,
      updatedAt: userAnimeProgress.updatedAt,
    })
    .from(userAnimeProgress)
    .innerJoin(anime, eq(userAnimeProgress.animeId, anime.id))
    .innerJoin(animeEpisodes, eq(userAnimeProgress.episodeId, animeEpisodes.id))
    .leftJoin(animeImages, and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true)))
    .where(eq(userAnimeProgress.userId, userId))
    .orderBy(desc(userAnimeProgress.updatedAt))
    .limit(30);

  const resumeItems: Array<{
    animeId: number;
    title: string;
    posterUrl: string | null;
    episodeNumber: number;
    durationSec: number | null;
    progressDurationSec: number | null;
    progressSec: number;
  }> = [];

  const seenAnime = new Set<number>();
  for (const row of progressRows) {
    if (seenAnime.has(row.animeId) || hiddenAnimeIds.has(row.animeId)) continue;
    if (row.progressSec < 15) continue;
    seenAnime.add(row.animeId);
    resumeItems.push({
      animeId: row.animeId,
      title: row.title,
      posterUrl: row.posterUrl,
      episodeNumber: row.episodeNumber,
      durationSec: row.durationSec,
      progressDurationSec: row.progressDurationSec,
      progressSec: row.progressSec,
    });
    if (resumeItems.length >= 2) break;
  }

  return (
    <ProfileClient
      user={{
        name: session.user.name,
        email: session.user.email,
        image: resolveClientAssetUrl(session.user.image ?? null),
      }}
      counts={counts}
      initialTab={tab}
      initialItems={items}
      resumeItems={resumeItems}
    />
  );
}