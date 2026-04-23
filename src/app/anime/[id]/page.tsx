import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "../../../server/db";
import {
  anime,
  animeGenres,
  animeImages,
  favorites,
  genres,
  ratings,
  userAnimeStatus,
} from "../../../server/db/schema";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import AnimeUserActions from "../../components/AnimeUserActions";

type PageProps = {
  params: Promise<{ id: string }>;
};

function statusToRu(v: string | null | undefined) {
  if (!v) return "—";
  if (v === "ongoing") return "В процессе";
  if (v === "completed") return "Завершено";
  if (v === "hiatus") return "Пауза";
  return v;
}

function formatRating(v: number | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(1) : "0.0";
}

export default async function AnimePlayerPage({ params }: PageProps) {
  const { id } = await params;
  const animeId = Number.parseInt(id, 10);

  if (Number.isNaN(animeId)) notFound();

  const rows = await db
    .select({
      id: anime.id,
      title: anime.title,
      description: anime.description,
      releaseYear: anime.releaseYear,
      status: anime.status,
      externalUrl: anime.externalUrl,
      posterUrl: animeImages.imageUrl,
    })
    .from(anime)
    .leftJoin(
      animeImages,
      and(eq(animeImages.animeId, anime.id), eq(animeImages.isPoster, true))
    )
    .where(eq(anime.id, animeId))
    .limit(1);

  const item = rows[0];
  if (!item) notFound();

  const genreRows = await db
    .select({ name: genres.name })
    .from(animeGenres)
    .innerJoin(genres, eq(animeGenres.genreId, genres.id))
    .where(eq(animeGenres.animeId, animeId))
    .orderBy(asc(genres.name));

  const itemGenres = genreRows.map((g) => g.name);

  const [agg] = await db
    .select({
      avgRating: sql<number>`coalesce(avg(${ratings.value}), 0)::float`.as("avgRating"),
      ratingsCount: sql<number>`count(${ratings.id})::int`.as("ratingsCount"),
    })
    .from(ratings)
    .where(eq(ratings.animeId, animeId));

  const avgRating = Number(agg?.avgRating ?? 0);
  const ratingsCount = Number(agg?.ratingsCount ?? 0);

  const distRows = await db
    .select({
      value: ratings.value,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(ratings)
    .where(eq(ratings.animeId, animeId))
    .groupBy(ratings.value)
    .orderBy(asc(ratings.value));

  const ratingDist = Array.from({ length: 11 }, () => 0);
  for (const r of distRows) {
    const v = Number(r.value);
    const c = Number(r.count);
    if (Number.isInteger(v) && v >= 1 && v <= 10) {
      ratingDist[v] = c;
    }
  }

  const maxDist = Math.max(0, ...ratingDist.slice(1));

  const session = await getServerSession(authOptions);
  let initialStatus: "watching" | "planned" | "dropped" | "completed" | null = null;
  let initialRating: number | null = null;
  let initialLoved = false;

  const userId = Number.parseInt(session?.user?.id ?? "", 10);
  if (Number.isSafeInteger(userId)) {
    const st = await db.query.userAnimeStatus.findFirst({
      where: and(eq(userAnimeStatus.userId, userId), eq(userAnimeStatus.animeId, animeId)),
    });

    type WatchStatus = "watching" | "planned" | "dropped" | "completed";

    const ALLOWED_STATUSES: WatchStatus[] = [
      "watching",
      "planned",
      "dropped",
      "completed",
    ];

    const rawStatus = st?.status;
    initialStatus =
      rawStatus && ALLOWED_STATUSES.includes(rawStatus as WatchStatus)
        ? (rawStatus as WatchStatus)
        : null;

    const rt = await db.query.ratings.findFirst({
      where: and(eq(ratings.userId, userId), eq(ratings.animeId, animeId)),
    });
    initialRating = rt?.value ?? null;

    const fv = await db.query.favorites.findFirst({
      where: and(eq(favorites.userId, userId), eq(favorites.animeId, animeId)),
    });
    initialLoved = Boolean(fv);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070d]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.14),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.12]" />
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-32 right-[6%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 px-4 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-purple-200 backdrop-blur-md">
              Страница аниме
            </div>

            <Link
              href="/catalog"
              className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2.5 text-sm text-white transition hover:bg-white/12"
            >
              ← Вернуться в каталог
            </Link>
          </div>

          <div className="rounded-[32px] border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div>
                <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-black/20">
                  <div className="relative aspect-[3/4] w-full">
                    {item.posterUrl ? (
                      <Image
                        src={item.posterUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-600/20 to-fuchsia-600/10">
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-purple-600 to-violet-600 shadow-lg shadow-purple-500/25">
                          <Image src="/fox.png" alt="Kitsune" width={38} height={38} />
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                      ★ {formatRating(avgRating)}
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                        {item.releaseYear ?? "—"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                        {statusToRu(item.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
                    Смотреть онлайн
                  </div>

                  <h1 className="text-3xl font-bold text-white sm:text-4xl">
                    {item.title}
                  </h1>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label="Год" value={String(item.releaseYear ?? "—")} />
                    <InfoBadge label="Статус" value={statusToRu(item.status)} />
                    <InfoBadge label="Средняя" value={formatRating(avgRating)} />
                    <InfoBadge label="Оценок" value={String(ratingsCount)} />
                  </div>

                  {itemGenres.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-sm text-gray-400">Жанры</div>
                      <div className="flex flex-wrap gap-2">
                        {itemGenres.map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-sm text-purple-100"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 text-sm text-gray-400">Описание</div>
                    <p className="leading-7 text-gray-200">
                      {item.description ?? "Описание отсутствует."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-black/20 shadow-xl backdrop-blur-xl sm:rounded-[30px]">
                <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-100">
                      Смотреть онлайн
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-300">
                      iframe player
                    </div>
                  </div>

                  <div className="max-w-xl">
                    <div className="text-xl font-semibold text-white sm:text-2xl">Плеер</div>
                    <div className="mt-1 text-sm leading-6 text-gray-400">
                      На телефоне блок адаптирован под быстрый просмотр и полноэкранный режим.
                    </div>
                  </div>
                </div>

                <div className="px-0 pb-0 sm:px-6 sm:pb-6">
                  <div className="relative overflow-hidden border-y border-white/10 bg-black sm:rounded-[26px] sm:border">
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/55 via-black/15 to-transparent" />
                    <div className="pointer-events-none absolute left-4 top-4 z-20 flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                        {item.releaseYear ?? "—"}
                      </span>
                      <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
                        Full width mobile
                      </span>
                    </div>

                    <div className="aspect-[16/10] w-full sm:aspect-video">
                      {item.externalUrl ? (
                        <iframe
                          src={item.externalUrl}
                          title={item.title}
                          className="h-full w-full"
                          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.18),transparent_35%)] px-6 text-center">
                          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                            Плеер недоступен
                          </div>
                          <div className="mt-3 max-w-xs text-sm leading-6 text-gray-400">
                            Для этого аниме ещё не добавлена ссылка на онлайн просмотр.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-white">Распределение оценок</div>
                    <div className="mt-1 text-sm text-gray-400">
                      От 1 до 10 по оценкам пользователей
                    </div>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/90">
                    Средняя: {formatRating(avgRating)}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {Array.from({ length: 10 }, (_, i) => 10 - i).map((value) => {
                    const count = ratingDist[value] ?? 0;
                    const pct = maxDist > 0 ? Math.round((count / maxDist) * 100) : 0;

                    return (
                      <div key={value} className="flex items-center gap-3">
                        <div className="w-8 text-xs text-gray-300">{value}</div>

                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="w-10 text-right text-xs text-gray-400">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                <div className="mb-2 text-xl font-semibold text-white">Мои действия</div>
                <div className="mb-4 text-sm text-gray-400">
                  Добавь в любимое, поставь оценку и отметь статус просмотра
                </div>

                <AnimeUserActions
                  animeId={animeId}
                  initialStatus={initialStatus}
                  initialRating={initialRating}
                  initialLoved={initialLoved}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}