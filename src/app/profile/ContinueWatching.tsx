"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, X } from "lucide-react";

export type ResumeAnimeItem = {
  animeId: number;
  title: string;
  posterUrl: string | null;
  episodeNumber: number;
  durationSec: number | null;
  progressDurationSec: number | null;
  progressSec: number;
};

function progressPct(item: ResumeAnimeItem) {
  const total = item.progressDurationSec ?? item.durationSec ?? 0;
  if (!total || total <= 0) return 12;
  return Math.max(3, Math.min(100, Math.round((item.progressSec / total) * 100)));
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ContinueWatching({
  initialItems,
}: {
  initialItems: ResumeAnimeItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [hidingId, setHidingId] = useState<number | null>(null);

  if (items.length === 0) return null;

  const hideAnime = async (animeId: number) => {
    setHidingId(animeId);
    try {
      const res = await fetch("/api/user/resume/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId }),
      });
      if (!res.ok) return;
      setItems((prev) => prev.filter((x) => x.animeId !== animeId));
    } finally {
      setHidingId(null);
    }
  };

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-purple-200/90">
            Продолжить просмотр
          </div>
          <p className="mt-1 text-sm text-gray-400">Последние тайтлы, на которых вы остановились</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.animeId}
            className="group relative overflow-hidden rounded-2xl border border-white/12 bg-gradient-to-br from-purple-500/12 via-violet-500/8 to-fuchsia-500/10 p-3 shadow-lg shadow-purple-900/10"
          >
            <button
              type="button"
              onClick={() => void hideAnime(item.animeId)}
              disabled={hidingId === item.animeId}
              aria-label={`Скрыть ${item.title}`}
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-gray-200 backdrop-blur-md transition hover:bg-black/70 hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <Link href={`/anime/${item.animeId}`} className="flex gap-3 pr-8">
              <div className="relative h-[88px] w-[62px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {item.posterUrl ? (
                  <Image
                    src={item.posterUrl}
                    alt={item.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-gray-500">
                    No Image
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-semibold leading-snug text-white">
                  {item.title}
                </div>
                <div className="mt-1 text-xs text-purple-200/85">
                  Серия {item.episodeNumber} • {formatTime(item.progressSec)}
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-400"
                    style={{ width: `${progressPct(item)}%` }}
                  />
                </div>

                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/90">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                    <Play className="h-3 w-3 fill-white text-white" />
                  </span>
                  Продолжить
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
