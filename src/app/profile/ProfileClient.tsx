"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  Heart,
  type LucideIcon,
} from "lucide-react";
import SelectMenu, { type SelectOption } from "../components/SelectMenu";

type WatchStatus = "watching" | "planned" | "dropped" | "completed";
type TabKey = WatchStatus | "loved";

const TABS: {
  key: TabKey;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    key: "watching",
    label: "Смотрю",
    hint: "То, что сейчас в процессе",
    icon: Eye,
    accent:
      "from-sky-500/20 via-cyan-500/15 to-teal-500/15 text-sky-100 ring-sky-400/30",
  },
  {
    key: "planned",
    label: "Отложено",
    hint: "Оставил на потом",
    icon: Clock3,
    accent:
      "from-amber-500/20 via-orange-500/15 to-yellow-500/15 text-amber-100 ring-amber-400/30",
  },
  {
    key: "dropped",
    label: "Брошено",
    hint: "Не зашло или paused надолго",
    icon: Ban,
    accent:
      "from-rose-500/20 via-pink-500/15 to-red-500/15 text-rose-100 ring-rose-400/30",
  },
  {
    key: "completed",
    label: "Просмотрено",
    hint: "Уже досмотрено",
    icon: CheckCircle2,
    accent:
      "from-emerald-500/20 via-green-500/15 to-teal-500/15 text-emerald-100 ring-emerald-400/30",
  },
  {
    key: "loved",
    label: "Любимое",
    hint: "Лучшее из коллекции",
    icon: Heart,
    accent:
      "from-fuchsia-500/20 via-pink-500/15 to-purple-500/15 text-fuchsia-100 ring-fuchsia-400/30",
  },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "none", label: "Не в списке" },
  { value: "watching", label: "Смотрю" },
  { value: "planned", label: "Отложено" },
  { value: "dropped", label: "Брошено" },
  { value: "completed", label: "Просмотрено" },
];

const RATING_OPTIONS: SelectOption[] = [
  { value: "none", label: "Оценка" },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

type Item = {
  animeId: number;
  title: string;
  releaseYear: number | null;
  description: string | null;
  posterUrl: string | null;
  status: WatchStatus | null;
  userRating: number | null;
  loved: boolean;
};

export default function ProfileClient({
  user,
  counts,
  initialTab,
  initialItems,
}: {
  user: { name?: string | null; email?: string | null };
  counts: Record<string, number>;
  initialTab: TabKey;
  initialItems: Item[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [items, setItems] = useState<Item[]>(initialItems as any);
  const [loading, setLoading] = useState(false);

  const tabCounts = useMemo(() => {
    const base: Record<TabKey, number> = {
      watching: 0,
      planned: 0,
      dropped: 0,
      completed: 0,
      loved: 0,
    };
    for (const k of Object.keys(base) as TabKey[]) {
      base[k] = counts[k] ?? 0;
    }
    return base;
  }, [counts]);

  const loadTab = async (next: TabKey) => {
    setTab(next);
    setLoading(true);

    const url =
      next === "loved" ? "/api/user/loved" : `/api/user/anime-status?status=${next}`;

    const res = await fetch(url);
    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setItems((Array.isArray(data.items) ? data.items : []) as any);
    setLoading(false);
  };

  const toggleLoved = async (animeId: number, nextLoved: boolean) => {
    const res = await fetch("/api/user/loved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId, loved: nextLoved }),
    });

    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }

    if (tab === "loved" && !nextLoved) {
      setItems((prev) => prev.filter((x) => x.animeId !== animeId));
    } else {
      setItems((prev) =>
        prev.map((x) => (x.animeId === animeId ? { ...x, loved: nextLoved } : x))
      );
    }

    router.refresh();
  };

  const updateStatus = async (animeId: number, nextStatus: WatchStatus | "none") => {
    const res = await fetch("/api/user/anime-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId, status: nextStatus }),
    });

    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }

    if (tab !== "loved") {
      if (nextStatus === "none" || nextStatus !== tab) {
        setItems((prev) => prev.filter((x) => x.animeId !== animeId));
      } else {
        setItems((prev) =>
          prev.map((x) => (x.animeId === animeId ? { ...x, status: nextStatus } : x))
        );
      }
    } else {
      setItems((prev) =>
        prev.map((x) =>
          x.animeId === animeId
            ? { ...x, status: nextStatus === "none" ? null : nextStatus }
            : x
        )
      );
    }

    router.refresh();
  };

  const updateRating = async (animeId: number, value: number | "none") => {
    const res = await fetch("/api/user/rating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animeId, value: value === "none" ? null : value }),
    });

    if (res.status === 401) {
      router.push("/auth/login");
      return;
    }

    setItems((prev) =>
      prev.map((x) =>
        x.animeId === animeId ? { ...x, userRating: value === "none" ? null : value } : x
      )
    );

    router.refresh();
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

      <div className="relative z-10 px-4 pt-28 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[32px] border border-white/15 bg-white/[0.07] p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 shadow-lg shadow-purple-500/25">
                  <Image src="/fox.png" alt="Avatar" width={44} height={44} />
                </div>

                <div>
                  <div className="text-2xl font-bold text-white">
                    {user.name ?? "Пользователь"}
                  </div>
                  <div className="text-gray-300">{user.email ?? ""}</div>
                </div>
              </div>

              <Link
                href="/auth/signout?callbackUrl=/"
                className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 text-center font-semibold text-white shadow-lg shadow-red-500/25 transition hover:from-red-600 hover:to-pink-600 md:w-auto"
              >
                Выйти
              </Link>
            </div>

            <div className="-mx-1 mt-8 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => loadTab(t.key)}
                  className={`group min-w-[176px] snap-start rounded-[26px] border p-4 text-left transition sm:min-w-0 ${
                    tab === t.key
                      ? `bg-gradient-to-br ${t.accent} ring-1`
                      : "border-white/10 bg-white/[0.05] text-gray-300 hover:border-white/20 hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                        tab === t.key
                          ? "border-white/15 bg-white/10"
                          : "border-white/10 bg-black/20 text-gray-300 group-hover:border-white/15"
                      }`}
                    >
                      <t.icon
                        className={`h-5 w-5 ${
                          tab === t.key && t.key === "loved" ? "fill-current" : ""
                        }`}
                      />
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        tab === t.key
                          ? "bg-black/25 text-white"
                          : "bg-white/8 text-gray-300 group-hover:bg-white/12"
                      }`}
                    >
                      {tabCounts[t.key]}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-base font-semibold text-white">{t.label}</div>
                    <div
                      className={`mt-1 text-xs leading-5 ${
                        tab === t.key ? "text-white/75" : "text-gray-400"
                      }`}
                    >
                      {t.hint}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8">
              {loading ? (
                <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-6 text-gray-300 backdrop-blur-xl">
                  Загрузка…
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-6 text-gray-300 backdrop-blur-xl">
                  В этом разделе пока пусто.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => (
                    <div
                      key={a.animeId}
                      className="rounded-[26px] border border-white/12 bg-white/[0.06] shadow-xl backdrop-blur-xl"
                    >
                      <Link href={`/anime/${a.animeId}`} className="group block">
                        <div className="relative h-48 w-full bg-black/20">
                          {a.posterUrl ? (
                            <Image
                              src={a.posterUrl}
                              alt={a.title}
                              fill
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-400">
                              No Image
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        </div>

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="line-clamp-1 text-lg font-semibold text-white">
                                {a.title}
                              </div>
                              <div className="text-sm text-gray-400">{a.releaseYear ?? "—"}</div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleLoved(a.animeId, !a.loved);
                              }}
                              className={`shrink-0 rounded-xl border p-2 transition ${
                                a.loved
                                  ? "border-pink-500/40 bg-pink-500/20 text-pink-100"
                                  : "border-white/15 bg-white/10 text-white hover:bg-white/15"
                              }`}
                              title={a.loved ? "Убрать из любимого" : "Добавить в любимое"}
                            >
                              <Heart className={`h-5 w-5 ${a.loved ? "fill-current" : ""}`} />
                            </button>
                          </div>

                          <div className="mt-2 line-clamp-2 text-sm text-gray-300">
                            {a.description ?? "Описание отсутствует"}
                          </div>
                        </div>
                      </Link>

                      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                        <SelectMenu
                          value={(a.status ?? "none") as string}
                          options={STATUS_OPTIONS}
                          onChange={(v) => updateStatus(a.animeId, v as WatchStatus | "none")}
                          placement="top"
                          buttonClassName="bg-black/20 border-white/10 hover:bg-black/25 py-2 px-3"
                          menuClassName="min-w-[180px]"
                        />

                        <SelectMenu
                          value={a.userRating != null ? String(a.userRating) : "none"}
                          options={RATING_OPTIONS}
                          onChange={(v) =>
                            updateRating(a.animeId, v === "none" ? "none" : Number(v))
                          }
                          placement="top"
                          buttonClassName="bg-black/20 border-white/10 hover:bg-black/25 py-2 px-3"
                          menuClassName="min-w-[120px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
              <Link href="/catalog" className="text-gray-400 transition hover:text-white">
                ← В каталог
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}