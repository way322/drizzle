// src/app/catalog/CatalogClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import SelectMenu, { type SelectOption } from "../components/SelectMenu";

type SortKey = "new" | "rating" | "year";
type StatusKey = "all" | "ongoing" | "completed" | "hiatus";
type RatingOrder = "desc" | "asc";
type YearOrder = "desc" | "asc";

type CatalogItem = {
    id: number;
    title: string;
    description: string | null;
    releaseYear: number | null;
    status: string | null;
    posterUrl: string | null;
    rating: number;
    ratingsCount: number;
};

function uniqueById(items: CatalogItem[]) {
    const map = new Map<number, CatalogItem>();
    for (const item of items) {
        if (!map.has(item.id)) map.set(item.id, item);
    }
    return Array.from(map.values());
}

const STATUS_LABELS: Record<Exclude<StatusKey, "all">, string> = {
    ongoing: "В процессе",
    completed: "Завершено",
    hiatus: "Пауза",
};

const STATUS_OPTIONS: SelectOption[] = [
    { value: "all", label: "Все" },
    { value: "ongoing", label: "В процессе" },
    { value: "completed", label: "Завершено" },
    { value: "hiatus", label: "Пауза" },
];

const SORT_OPTIONS: SelectOption[] = [
    { value: "new", label: "Новые" },
    { value: "rating", label: "По рейтингу" },
    { value: "year", label: "По году" },
];

function statusToRu(v: string | null | undefined) {
    if (!v) return "—";
    return (STATUS_LABELS as any)[v] ?? v;
}

function formatRating(v: number | null | undefined) {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n.toFixed(1) : "0.0";
}

function joinGenres(genres: string[]) {
    return genres.map((g) => g.trim()).filter(Boolean).join(",");
}

export default function CatalogClient(props: {
    initialFilters: {
        status: StatusKey;
        sort: SortKey;
        ratingOrder: RatingOrder;
        yearOrder: YearOrder;
        yearFrom: string;
        yearTo: string;
        genres: string[];
    };
    allGenres: string[];
    initialLimit: number;
}) {
    const [panelOpen, setPanelOpen] = useState(false);
    const [genresOpen, setGenresOpen] = useState(true);

    const [status, setStatus] = useState<StatusKey>(props.initialFilters.status ?? "all");
    const [sort, setSort] = useState<SortKey>(props.initialFilters.sort ?? "new");
    const [ratingOrder, setRatingOrder] = useState<RatingOrder>(
        props.initialFilters.ratingOrder ?? "desc"
    );
    const [yearOrder, setYearOrder] = useState<YearOrder>(props.initialFilters.yearOrder ?? "desc");
    const [yearFrom, setYearFrom] = useState(props.initialFilters.yearFrom ?? "");
    const [yearTo, setYearTo] = useState(props.initialFilters.yearTo ?? "");
    const [selectedGenres, setSelectedGenres] = useState<string[]>(
        props.initialFilters.genres ?? []
    );

    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loadingFirst, setLoadingFirst] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [nextOffset, setNextOffset] = useState(0);

    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const didMountRef = useRef(false);

    const filtersKey = useMemo(() => {
        return JSON.stringify({
            status,
            sort,
            ratingOrder: sort === "rating" ? ratingOrder : "desc",
            yearOrder: sort === "year" ? yearOrder : "desc",
            yearFrom: yearFrom.trim(),
            yearTo: yearTo.trim(),
            genres: [...selectedGenres].sort(),
        });
    }, [status, sort, ratingOrder, yearOrder, yearFrom, yearTo, selectedGenres]);

    const buildUrl = () => {
        const sp = new URLSearchParams();

        if (status !== "all") sp.set("status", status);
        if (sort !== "new") sp.set("sort", sort);
        if (sort === "rating") sp.set("ratingOrder", ratingOrder);
        if (sort === "year") sp.set("yearOrder", yearOrder);

        const yf = yearFrom.trim();
        const yt = yearTo.trim();
        if (yf) sp.set("yearFrom", yf);
        if (yt) sp.set("yearTo", yt);

        if (selectedGenres.length) sp.set("genres", joinGenres(selectedGenres));

        const qs = sp.toString();
        return qs ? `/catalog?${qs}` : "/catalog";
    };

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }
        const t = setTimeout(() => {
            const nextUrl = buildUrl();
            const currentUrl = `${window.location.pathname}${window.location.search}`;
            if (nextUrl !== currentUrl) {
                window.history.replaceState(null, "", nextUrl);
            }
        }, 250);
        return () => clearTimeout(t);
    }, [filtersKey]);

    const fetchPage = async (offset: number) => {
        const sp = new URLSearchParams();
        sp.set("offset", String(offset));
        sp.set("limit", String(props.initialLimit));

        if (status !== "all") sp.set("status", status);
        sp.set("sort", sort);
        if (sort === "rating") sp.set("ratingOrder", ratingOrder);
        if (sort === "year") sp.set("yearOrder", yearOrder);
        if (yearFrom.trim()) sp.set("yearFrom", yearFrom.trim());
        if (yearTo.trim()) sp.set("yearTo", yearTo.trim());
        if (selectedGenres.length) sp.set("genres", joinGenres(selectedGenres));

        const res = await fetch(`/api/catalog/anime?${sp.toString()}`, { cache: "no-store" });
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Catalog API error ${res.status}: ${txt}`);
        }

        const data = await res.json().catch(() => ({}));

        return {
            items: (Array.isArray(data.items) ? data.items : []) as CatalogItem[],
            hasMore: Boolean(data.hasMore),
            nextOffset: Number.isFinite(Number(data.nextOffset)) ? Number(data.nextOffset) : offset,
        };
    };

    useEffect(() => {
        let cancelled = false;
        const isFirstLoad = items.length === 0;

        const t = setTimeout(async () => {
            try {
                if (isFirstLoad) {
                    setLoadingFirst(true);
                } else {
                    setRefreshing(true);
                }
                setHasMore(true);
                setNextOffset(0);

                const data = await fetchPage(0);
                if (cancelled) return;

                setItems(uniqueById(data.items));
                setHasMore(data.hasMore);
                setNextOffset(data.nextOffset);
            } finally {
                if (!cancelled) {
                    setLoadingFirst(false);
                    setRefreshing(false);
                }
            }
        }, 120);

        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [filtersKey]);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = panelOpen ? "hidden" : prevOverflow;
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [panelOpen]);

    useEffect(() => {
        if (!panelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPanelOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [panelOpen]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            async (entries) => {
                const entry = entries[0];
                if (!entry?.isIntersecting) return;
                if (loadingFirst || loadingMore || !hasMore) return;

                setLoadingMore(true);
                try {
                    const data = await fetchPage(nextOffset);
                    setItems((prev) => uniqueById([...prev, ...data.items]));
                    setHasMore(data.hasMore);
                    setNextOffset(data.nextOffset);
                } finally {
                    setLoadingMore(false);
                }
            },
            { root: null, rootMargin: "400px", threshold: 0.01 }
        );

        obs.observe(el);
        return () => obs.disconnect();
    }, [hasMore, loadingFirst, loadingMore, nextOffset, filtersKey]);

    const reset = () => {
        setStatus("all");
        setSort("new");
        setRatingOrder("desc");
        setYearOrder("desc");
        setYearFrom("");
        setYearTo("");
        setSelectedGenres([]);
        window.history.replaceState(null, "", "/catalog");
    };

    const toggleGenre = (name: string) => {
        setSelectedGenres((prev) => {
            const exists = prev.includes(name);
            return exists ? prev.filter((x) => x !== name) : [...prev, name];
        });
    };

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (status !== "all") n++;
        if (sort !== "new") n++;
        if (yearFrom.trim()) n++;
        if (yearTo.trim()) n++;
        n += selectedGenres.length;
        return n;
    }, [status, sort, yearFrom, yearTo, selectedGenres]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#07070d]">
            <div className="absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.14),transparent_30%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.12]" />
                <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
                <div className="absolute top-32 right-[6%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
            </div>

            <div className="relative z-10 px-4 pt-28 pb-28 sm:pb-32">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-8 flex flex-col gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-purple-200 backdrop-blur-md">
                                Каталог аниме
                            </div>
                            <h1 className="mt-4 text-4xl font-bold text-white">Каталог аниме</h1>
                            <p className="mt-2 text-gray-300">
                                Подбирай тайтлы по статусу, жанрам, году и рейтингу.
                            </p>
                        </div>
                    </div>

                    <section>
                            {loadingFirst ? (
                                <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-6 text-gray-300 shadow-xl backdrop-blur-xl">
                                    Загрузка…
                                </div>
                            ) : items.length === 0 ? (
                                <div className="rounded-[28px] border border-white/12 bg-white/[0.06] p-6 text-gray-300 shadow-xl backdrop-blur-xl">
                                    Ничего не найдено.
                                </div>
                            ) : (
                                <>
                                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
                                        <div className="text-sm text-gray-300">
                                            Найдено тайтлов: <span className="font-semibold text-white">{items.length}</span>
                                            {refreshing && <span className="ml-2 text-purple-200">• Обновляю…</span>}
                                            {loadingMore && <span className="ml-2 text-gray-400">• Подгружаю ещё…</span>}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {status !== "all" && (
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
                                                    {statusToRu(status)}
                                                </span>
                                            )}
                                            {sort === "rating" && (
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
                                                    Рейтинг: {ratingOrder === "desc" ? "убыв." : "возр."}
                                                </span>
                                            )}
                                            {sort === "year" && (
                                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
                                                    Год: {yearOrder === "desc" ? "убыв." : "возр."}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        className={`grid grid-cols-1 gap-6 transition-all duration-300 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 ${refreshing ? "opacity-75 blur-[0.6px]" : "opacity-100 blur-0"
                                            }`}
                                    >
                                        {items.map((a) => (
                                            <Link
                                                key={a.id}
                                                href={`/anime/${a.id}`}
                                                className="group block rounded-[26px] border border-white/12 bg-white/[0.06] p-4 shadow-xl backdrop-blur-xl transition hover:border-purple-500/30 hover:bg-white/[0.08]"
                                            >
                                                <div className="relative mb-4 h-52 w-full overflow-hidden rounded-2xl bg-black/20">
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
                                                    <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                                                        ★ {formatRating(a.rating)}
                                                    </div>
                                                </div>

                                                <h3 className="mb-1 line-clamp-1 text-lg font-semibold text-white">
                                                    {a.title}
                                                </h3>

                                                <p className="line-clamp-3 text-sm text-gray-300">
                                                    {a.description ?? "Описание отсутствует"}
                                                </p>

                                                <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-sm text-gray-400">
                                                    <span>{a.releaseYear ?? "—"}</span>
                                                    <span>•</span>
                                                    <span>{statusToRu(a.status)}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {formatRating(a.rating)}{" "}
                                                        <span className="text-gray-500">({a.ratingsCount})</span>
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>

                                    <div ref={sentinelRef} className="h-10" />

                                    {loadingMore && <div className="mt-4 text-gray-300">Подгружаю ещё…</div>}
                                    {!hasMore && (
                                        <div className="mt-6 text-sm text-gray-400">Больше ничего нет.</div>
                                    )}
                                </>
                            )}
                        </section>
                    </div>
                </div>

            {panelOpen && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[90] bg-[#05050a]/60 backdrop-blur-sm transition-opacity"
                        onClick={() => setPanelOpen(false)}
                        aria-label="Закрыть фильтры"
                    />

                    <aside
                        id="catalog-filters-panel"
                        className="fixed z-[100] flex max-h-[92vh] w-full flex-col border border-white/12 bg-[#0b0b14]/96 shadow-2xl backdrop-blur-2xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-[28px] max-sm:border-b-0 sm:inset-y-0 sm:left-0 sm:right-auto sm:top-0 sm:max-h-none sm:max-w-[380px] sm:rounded-none sm:rounded-r-[28px] sm:border-b-0 sm:border-r sm:border-t-0"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="catalog-filters-title"
                    >
                        <div className="flex shrink-0 justify-center pt-3 pb-1 sm:hidden" aria-hidden>
                            <div className="h-1.5 w-10 rounded-full bg-white/20" />
                        </div>

                        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
                            <div>
                                <div id="catalog-filters-title" className="text-lg font-semibold text-white">
                                    Фильтры
                                </div>
                                <div className="mt-1 text-xs text-gray-400">Поверх каталога — тапните вне панели или Esc</div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                className="rounded-xl p-2 text-gray-300 transition hover:bg-white/10 hover:text-white"
                                title="Закрыть"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="custom-dropdown-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
                            <div>
                                <div className="mb-1 text-xs text-gray-400">Статус</div>
                                <SelectMenu
                                    value={status}
                                    options={STATUS_OPTIONS}
                                    onChange={(v) => setStatus(v as StatusKey)}
                                />
                            </div>

                            <div>
                                <div className="mb-1 text-xs text-gray-400">Сортировка</div>
                                <SelectMenu
                                    value={sort}
                                    options={SORT_OPTIONS}
                                    onChange={(v) => setSort(v as SortKey)}
                                />

                                {sort === "rating" && (
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRatingOrder("desc")}
                                            className={`rounded-2xl border py-2 transition ${ratingOrder === "desc"
                                                    ? "border-white/30 bg-white/15 text-white"
                                                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                                                }`}
                                        >
                                            Убыв.
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRatingOrder("asc")}
                                            className={`rounded-2xl border py-2 transition ${ratingOrder === "asc"
                                                    ? "border-white/30 bg-white/15 text-white"
                                                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                                                }`}
                                        >
                                            Возр.
                                        </button>
                                    </div>
                                )}

                                {sort === "year" && (
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setYearOrder("desc")}
                                            className={`rounded-2xl border py-2 transition ${yearOrder === "desc"
                                                    ? "border-white/30 bg-white/15 text-white"
                                                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                                                }`}
                                        >
                                            Убыв.
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setYearOrder("asc")}
                                            className={`rounded-2xl border py-2 transition ${yearOrder === "asc"
                                                    ? "border-white/30 bg-white/15 text-white"
                                                    : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                                                }`}
                                        >
                                            Возр.
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="mb-1 text-xs text-gray-400">Год от</div>
                                    <input
                                        value={yearFrom}
                                        onChange={(e) => setYearFrom(e.target.value)}
                                        inputMode="numeric"
                                        placeholder="2010"
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                                    />
                                </div>
                                <div>
                                    <div className="mb-1 text-xs text-gray-400">Год до</div>
                                    <input
                                        value={yearTo}
                                        onChange={(e) => setYearTo(e.target.value)}
                                        inputMode="numeric"
                                        placeholder="2025"
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="button"
                                    onClick={() => setGenresOpen((p) => !p)}
                                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/8"
                                >
                                    <div className="text-sm text-gray-200">
                                        Жанры{" "}
                                        {selectedGenres.length > 0 && (
                                            <span className="text-gray-400">({selectedGenres.length})</span>
                                        )}
                                    </div>
                                    <span className="text-gray-300">{genresOpen ? "▾" : "▸"}</span>
                                </button>

                                {genresOpen && (
                                    <div className="custom-dropdown-scroll mt-2 max-h-64 overflow-auto rounded-2xl border border-white/10 bg-black/15 p-2 sm:p-3">
                                        {props.allGenres.length === 0 ? (
                                            <div className="text-sm text-gray-400">Жанров пока нет.</div>
                                        ) : (
                                            props.allGenres.map((g) => {
                                                const checked = selectedGenres.includes(g);
                                                return (
                                                    <label
                                                        key={g}
                                                        className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-1 py-1 text-sm text-gray-200 active:bg-white/5"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleGenre(g)}
                                                            className="h-6 w-6 shrink-0 rounded-md border border-white/20 bg-black/30 accent-purple-500"
                                                        />
                                                        <span className="truncate leading-snug">{g}</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0 border-t border-white/10 bg-[#0b0b14]/98 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(0,0,0,0.35)] sm:bg-[#0b0b14]/95">
                            <button
                                type="button"
                                onClick={reset}
                                className="w-full rounded-2xl border border-white/15 bg-white/10 py-3.5 text-base font-semibold text-white transition hover:bg-white/15 active:bg-white/20 sm:py-3 sm:text-sm"
                            >
                                Сбросить
                            </button>
                        </div>
                    </aside>
                </>
            )}

            {!panelOpen && (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className="pointer-events-auto group flex max-w-full items-center gap-3 rounded-full border border-white/20 bg-[#0b0b14]/85 py-2.5 pl-3 pr-2 shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_0_1px_rgba(168,85,247,0.15)] backdrop-blur-xl transition hover:border-purple-400/35 hover:bg-[#12121c]/92 hover:shadow-[0_12px_40px_rgba(88,28,135,0.25)] sm:pl-4 sm:pr-2.5"
                        aria-expanded={false}
                        aria-controls="catalog-filters-panel"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/30 transition group-hover:shadow-lg group-hover:shadow-purple-500/40">
                            <SlidersHorizontal className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-left sm:flex-initial">
                            <span className="block text-sm font-semibold text-white">Фильтры каталога</span>
                            <span className="hidden text-xs text-gray-400 sm:block">
                                Открыть с любого места страницы
                            </span>
                        </span>
                        {activeFilterCount > 0 && (
                            <span
                                className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/25 px-2.5 text-xs font-bold tabular-nums text-purple-100 ring-1 ring-purple-400/30"
                                title="Активных условий"
                            >
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}