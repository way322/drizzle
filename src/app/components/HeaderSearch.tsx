// src/app/components/HeaderSearch.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type SearchItem = {
  id: number;
  title: string;
  releaseYear: number | null;
  status: string | null;
  posterUrl: string | null;
  rating: number;
  ratingsCount: number;
};

function clampText(s: string, max = 80) {
  const t = (s ?? "").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default function HeaderSearch() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [active, setActive] = useState<number>(-1);

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;

      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || Boolean(el?.isContentEditable);

      if (isTyping) return;

      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const qq = q.trim();
    setActive(-1);

    if (!qq) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (qq.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/search/anime?q=${encodeURIComponent(qq)}&limit=10`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));
        setItems(Array.isArray(data.items) ? data.items : []);
        setOpen(true);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  const go = (id: number) => {
    setOpen(false);
    setActive(-1);
    setQ("");
    router.push(`/anime/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }

    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => Math.min(p + 1, items.length - 1));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => Math.max(p - 1, 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const idx = active >= 0 ? active : 0;
      const it = items[idx];
      if (it) go(it.id);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full md:max-w-[22rem]">
      <div className="relative">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Поиск аниме… (нажми /)"
          className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-purple-400/60"
        />

        {q.trim().length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setItems([]);
              setOpen(false);
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
            aria-label="Очистить поиск"
          >
            ✕
          </button>
        )}
      </div>

      {open && (canSearch || loading) && (
        <div className="absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]/95 shadow-2xl backdrop-blur-xl md:right-auto md:w-[min(520px,calc(100vw-24px))]">
          <div className="px-4 py-2 text-xs text-gray-400 border-b border-white/10 flex items-center justify-between">
            <span>{loading ? "Ищу…" : items.length ? `Найдено: ${items.length}` : "Ничего не найдено"}</span>
            <span className="hidden sm:inline">Enter — открыть • Esc — закрыть</span>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-gray-300">Загрузка…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-4 text-gray-300">Попробуй другой запрос.</div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              {items.map((it, idx) => {
                const isActive = idx === active;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(it.id)}
                    className={`w-full text-left px-4 py-3 flex gap-3 items-center border-b border-white/5 transition ${
                      isActive ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-black/30 border border-white/10 flex-shrink-0">
                      {it.posterUrl ? (
                        <Image src={it.posterUrl} alt={it.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-white font-semibold line-clamp-1">
                        {clampText(it.title, 90)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {it.releaseYear ?? "—"} • {it.status ?? "—"} •{" "}
                        {Number(it.rating ?? 0).toFixed(1)}{" "}
                        <span className="text-gray-500">({it.ratingsCount ?? 0})</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}