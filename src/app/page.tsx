// src/app/page.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  BarChart3,
  Flame,
  LibraryBig,
  Search,
  Shield,
  Sparkles,
  Clock3,
} from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { authOptions } from "@/lib/authOptions";
import { db } from "../server/db";
import {
  anime as animeTable,
  animeImages,
  genres as genresTable,
  users as usersTable,
  ratings,
} from "../server/db/schema";
import type { SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

type HomeAnimeCard = {
  id: number;
  title: string;
  description: string | null;
  releaseYear: number | null;
  status: string | null;
  rating: number | null;
  ratingsCount: number;
  posterUrl: string | null;
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthed = Boolean(session);
  const isAdmin = session?.user?.role === "admin";

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

  const ratingVal = sql<number>`coalesce(${ratingAggCols.avgRating}, 0)`;
  const ratingsCountVal = sql<number>`coalesce(${ratingAggCols.ratingsCount}, 0)`;

  const [animeCountRow, genreCountRow, userCountRow, featuredAnime, latestAnime] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(animeTable),
      db.select({ count: sql<number>`count(*)::int` }).from(genresTable),
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable),

      db
        .select({
          id: animeTable.id,
          title: animeTable.title,
          description: animeTable.description,
          releaseYear: animeTable.releaseYear,
          status: animeTable.status,
          rating: ratingVal.as("rating"),
          ratingsCount: ratingsCountVal.as("ratingsCount"),
          posterUrl: animeImages.imageUrl,
        })
        .from(animeTable)
        .leftJoin(ratingAgg, eq(ratingAggCols.animeId, animeTable.id))
        .leftJoin(
          animeImages,
          and(eq(animeImages.animeId, animeTable.id), eq(animeImages.isPoster, true))
        )
        .orderBy(desc(ratingVal), desc(ratingsCountVal), desc(animeTable.createdAt))
        .limit(3),

      db
        .select({
          id: animeTable.id,
          title: animeTable.title,
          description: animeTable.description,
          releaseYear: animeTable.releaseYear,
          status: animeTable.status,
          rating: ratingVal.as("rating"),
          ratingsCount: ratingsCountVal.as("ratingsCount"),
          posterUrl: animeImages.imageUrl,
        })
        .from(animeTable)
        .leftJoin(ratingAgg, eq(ratingAggCols.animeId, animeTable.id))
        .leftJoin(
          animeImages,
          and(eq(animeImages.animeId, animeTable.id), eq(animeImages.isPoster, true))
        )
        .orderBy(desc(animeTable.createdAt))
        .limit(6),
    ]);

  const stats = {
    anime: Number(animeCountRow[0]?.count ?? 0),
    genres: Number(genreCountRow[0]?.count ?? 0),
    users: Number(userCountRow[0]?.count ?? 0),
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070d]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.14),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.12]" />
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-32 right-[6%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 px-4 pt-28 pb-16">
        <div className="mx-auto max-w-7xl">
          <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-purple-200 backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                Ваша персональная аниме-библиотека
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight text-white sm:text-6xl xl:text-7xl">
                Kitsune —
                <span className="block bg-gradient-to-r from-purple-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  красиво хранить,
                </span>
                <span className="mt-2 block text-[1.375rem] font-bold leading-snug tracking-tight text-white/93 sm:mt-3 sm:text-5xl sm:font-black sm:leading-tight sm:text-white/95 xl:text-7xl">
                  искать и отмечать аниме
                </span>
              </h1>

              <div className="mt-5 max-w-2xl rounded-[22px] border border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-md sm:mt-6 sm:rounded-none sm:border-0 sm:bg-none sm:p-0 sm:shadow-none sm:backdrop-blur-none">
                <p className="text-[15px] font-medium leading-7 text-white/95 sm:text-xl sm:font-normal sm:leading-8 sm:text-gray-200">
                  Каталог, быстрый поиск, личные списки, избранное, оценки и удобная админка
                  для наполнения базы.
                </p>
              </div>

              <div className="mx-auto mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mx-0 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-4">
                {isAuthed ? (
                  <>
                    <Link
                      href="/catalog"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-4 font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:scale-[1.02] hover:from-purple-700 hover:to-violet-700 sm:w-auto sm:justify-start"
                    >
                      Открыть каталог
                      <ArrowRight className="h-5 w-5" />
                    </Link>

                    <Link
                      href="/profile"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-6 py-4 font-semibold text-white backdrop-blur-md transition hover:bg-white/12 sm:w-auto sm:justify-start"
                    >
                      Перейти в профиль
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/30 bg-purple-500/10 px-6 py-4 font-semibold text-purple-100 transition hover:bg-purple-500/15 sm:w-auto sm:justify-start"
                      >
                        <Shield className="h-5 w-5" />
                        Админ-панель
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/register"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-4 font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:scale-[1.02] hover:from-purple-700 hover:to-violet-700 sm:w-auto sm:justify-start"
                    >
                      Создать аккаунт
                      <ArrowRight className="h-5 w-5" />
                    </Link>

                    <Link
                      href="/auth/login"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-6 py-4 font-semibold text-white backdrop-blur-md transition hover:bg-white/12 sm:w-auto sm:justify-start"
                    >
                      Войти
                    </Link>
                  </>
                )}
              </div>

              <div className="mx-auto mt-8 flex w-full max-w-md flex-wrap justify-center gap-x-2 gap-y-2 sm:mx-0 sm:max-w-none sm:justify-start sm:gap-x-3 sm:gap-y-3">
                <QuickLink href="/catalog?sort=rating" label="Лучшее по рейтингу" />
                <QuickLink href="/catalog?status=ongoing" label="Сейчас выходят" />
                <QuickLink href="/catalog?status=completed" label="Завершённые" />
                <QuickLink href="/catalog?sort=year" label="По году" />
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <StatCard value={stats.anime} label="Тайтлов в базе" />
                <StatCard value={stats.genres} label="Жанров" />
                <StatCard value={stats.users} label="Пользователей" />
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-xl backdrop-blur-xl sm:rounded-[32px] sm:p-4 sm:shadow-2xl">
                <div className="max-sm:p-0 sm:rounded-[28px] sm:border sm:border-white/10 sm:bg-gradient-to-br sm:from-white/10 sm:to-white/5 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 shadow-lg shadow-purple-500/25 sm:h-14 sm:w-14">
                        <Image src="/fox.png" alt="Kitsune" width={28} height={28} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-purple-200/80 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-gray-400">
                          Быстрый старт
                        </div>
                        <div className="mt-0.5 text-lg font-bold leading-snug text-white sm:mt-0 sm:text-xl">
                          {isAuthed
                            ? `Привет, ${session?.user?.name ?? "пользователь"}`
                            : "Добро пожаловать"}
                        </div>
                      </div>
                    </div>
                    <div className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center text-xs leading-snug text-gray-300 sm:w-auto sm:shrink-0 sm:rounded-full sm:py-1.5 sm:text-left">
                      Нажми <kbd className="rounded border border-white/15 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/90 sm:text-xs">/</kbd> для поиска
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <FeatureMini
                      icon={<Search className="h-5 w-5" />}
                      title="Быстрый поиск"
                      text="Поиск по названию прямо из хедера с быстрым открытием страницы тайтла."
                    />
                    <FeatureMini
                      icon={<LibraryBig className="h-5 w-5" />}
                      title="Личный список"
                      text="Отмечай: смотрю, отложено, брошено, просмотрено."
                    />
                    <FeatureMini
                      icon={<BarChart3 className="h-5 w-5" />}
                      title="Оценки и избранное"
                      text="Сохраняй любимые аниме и ставь свои оценки."
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <GlassButton href="/catalog" label="Каталог" />
                    <GlassButton
                      href={isAuthed ? "/profile" : "/auth/login"}
                      label={isAuthed ? "Профиль" : "Вход"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-20">
            <SectionTitle
              eyebrow="Возможности"
              title="Не просто красивая главная, а полезная стартовая точка"
              text="Сразу ведёт пользователя в каталог, профиль, поиск и популярные разделы."
            />

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <FeatureCard
                icon={<Search className="h-6 w-6" />}
                title="Умный вход в каталог"
                text="Быстрые ссылки по статусам и рейтингу помогают перейти к просмотру без лишних кликов."
              />
              <FeatureCard
                icon={<LibraryBig className="h-6 w-6" />}
                title="Персональный прогресс"
                text="После входа пользователь сразу получает доступ к профилю, спискам и любимым тайтлам."
              />
              <FeatureCard
                icon={<Shield className="h-6 w-6" />}
                title="Поддержка админа"
                text="Если аккаунт админский — на главной сразу появляется прямой доступ в панель управления."
              />
            </div>
          </section>

          <section className="mt-20">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.22em] text-purple-300">
                  Популярное
                </div>
                <h2 className="mt-2 text-3xl font-bold text-white">Лучшее из базы</h2>
              </div>

              <Link
                href="/catalog?sort=rating"
                className="inline-flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"
              >
                Смотреть всё
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {featuredAnime.length === 0 ? (
              <EmptyBlock text="Пока в базе нет тайтлов. Добавь их через админку — и секция заполнится автоматически." />
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                {featuredAnime.map((item, index) => (
                  <FeaturedAnimeCard key={item.id} item={item} index={index} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-20">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.22em] text-violet-300">
                  <Clock3 className="h-4 w-4" />
                  Недавно добавленные
                </div>
                <h2 className="mt-2 text-3xl font-bold text-white">Свежие тайтлы</h2>
              </div>

              <Link
                href="/catalog?sort=new"
                className="inline-flex items-center gap-2 text-sm text-gray-300 transition hover:text-white"
              >
                Открыть каталог
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {latestAnime.length === 0 ? (
              <EmptyBlock text="Недавно добавленные тайтлы появятся здесь автоматически." />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {latestAnime.map((item) => (
                  <CompactAnimeCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-20">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-purple-600/15 via-violet-600/10 to-fuchsia-600/15 p-8 backdrop-blur-xl sm:p-10">
              <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

              <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-purple-100">
                    <Flame className="h-4 w-4" />
                    Готово к использованию
                  </div>

                  <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">
                    Сделай главную страницу местом, куда приятно возвращаться
                  </h2>

                  <p className="mt-4 text-lg leading-8 text-gray-200/90">
                    Уже сейчас можно искать аниме, вести личные списки, сохранять
                    любимое, ставить оценки и управлять базой через админку.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/catalog"
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-semibold text-gray-900 transition hover:scale-[1.02]"
                  >
                    Перейти в каталог
                    <ArrowRight className="h-5 w-5" />
                  </Link>

                  {!isAuthed && (
                    <Link
                      href="/auth/register"
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 font-semibold text-white transition hover:bg-white/15"
                    >
                      Зарегистрироваться
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-sm font-medium uppercase tracking-[0.22em] text-purple-300">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-gray-300">{text}</p>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-md">
      <div className="text-3xl font-black text-white">{value.toLocaleString("ru-RU")}+</div>
      <div className="mt-1 text-sm text-gray-400">{label}</div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10 hover:text-white"
    >
      {label}
    </Link>
  );
}

function GlassButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-medium text-white transition hover:bg-white/10"
    >
      {label}
    </Link>
  );
}

function FeatureMini({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-purple-600/30 to-violet-600/30 text-purple-200">
        {icon}
      </div>
      <div className="font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm leading-6 text-gray-400">{text}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/6 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-purple-400/25 hover:bg-white/8">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600/20 to-violet-600/20 text-purple-200">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white">{title}</h3>
      <p className="mt-3 leading-7 text-gray-300">{text}</p>
    </div>
  );
}

function FeaturedAnimeCard({
  item,
  index,
}: {
  item: HomeAnimeCard;
  index: number;
}) {
  return (
    <Link
      href={`/anime/${item.id}`}
      className="group overflow-hidden rounded-[30px] border border-white/10 bg-white/6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-purple-400/30"
    >
      <div className="relative h-72 w-full overflow-hidden bg-black/30">
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500">
            No Image
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

        <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
          TOP {index + 1}
        </div>

        <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
            ★ {formatRating(item.rating)}
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
            Оценок: {item.ratingsCount}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="text-sm text-purple-200">
            {item.releaseYear ?? "—"} • {statusToRu(item.status)}
          </div>
          <h3 className="mt-2 text-2xl font-bold text-white line-clamp-2">{item.title}</h3>
          <p className="mt-3 text-sm leading-6 text-gray-200/90 line-clamp-3">
            {item.description ?? "Описание отсутствует"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CompactAnimeCard({ item }: { item: HomeAnimeCard }) {
  return (
    <Link
      href={`/anime/${item.id}`}
      className="group flex gap-4 rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-xl transition hover:border-violet-400/30 hover:bg-white/8"
    >
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl bg-black/30">
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-500">
            No Image
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span>{item.releaseYear ?? "—"}</span>
          <span>•</span>
          <span>{statusToRu(item.status)}</span>
          <span>•</span>
          <span>★ {formatRating(item.rating)}</span>
          <span>•</span>
          <span>{item.ratingsCount} оценок</span>
        </div>

        <div className="mt-2 text-lg font-semibold text-white line-clamp-1">
          {item.title}
        </div>

        <div className="mt-2 text-sm leading-6 text-gray-300 line-clamp-3">
          {item.description ?? "Описание отсутствует"}
        </div>
      </div>
    </Link>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-gray-300">
      {text}
    </div>
  );
}