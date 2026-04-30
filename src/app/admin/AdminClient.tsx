// src/app/admin/AdminClient.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import SelectMenu, { type SelectOption } from "../components/SelectMenu";
import AdminSectionNav from "./AdminSectionNav";

type AdminAnimeItem = {
  id: number;
  title: string;
  description: string | null;
  releaseYear: number | null;
  status: string | null;
  rating: number | null;
  externalUrl: string;
  posterUrl: string | null;
  genres: string[];
};

type FormState = {
  title: string;
  description: string;
  releaseYear: string;
  status: string;
  externalUrl: string;
  posterUrl: string;
  genres: string[];
};

const emptyForm: FormState = {
  title: "",
  description: "",
  releaseYear: "",
  status: "ongoing",
  externalUrl: "",
  posterUrl: "",
  genres: [],
};

const STATUS_FILTERS = [
  { value: "all", label: "Все" },
  { value: "ongoing", label: "В процессе" },
  { value: "completed", label: "Завершено" },
  { value: "hiatus", label: "Пауза" },
] as const;

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "Все" },
  { value: "ongoing", label: "В процессе" },
  { value: "completed", label: "Завершено" },
  { value: "hiatus", label: "Пауза" },
];

const FORM_STATUS_OPTIONS: SelectOption[] = [
  { value: "ongoing", label: "В процессе" },
  { value: "completed", label: "Завершено" },
  { value: "hiatus", label: "Пауза" },
];

function statusToRu(v: string | null | undefined) {
  if (!v) return "—";
  if (v === "ongoing") return "В процессе";
  if (v === "completed") return "Завершено";
  if (v === "hiatus") return "Пауза";
  return v;
}

export default function AdminClient() {
  const [items, setItems] = useState<AdminAnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]["value"]>("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [newGenre, setNewGenre] = useState("");
  const [genreSearch, setGenreSearch] = useState("");
  const [genresLoading, setGenresLoading] = useState(false);

  const loadGenres = async () => {
    setGenresLoading(true);
    const res = await fetch("/api/admin/genres", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    const names = Array.isArray(data.items)
      ? data.items.map((x: { name?: unknown }) => String(x?.name ?? ""))
      : [];
    setAllGenres(names);
    setGenresLoading(false);
  };

  const addGenre = async () => {
    const name = newGenre.trim();
    if (!name) return;

    const res = await fetch("/api/admin/genres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка добавления жанра");
      return;
    }

    setNewGenre("");
    await loadGenres();
  };

  const load = async (opts?: { q?: string; status?: string }) => {
    setLoading(true);

    const sp = new URLSearchParams();
    if (opts?.q) sp.set("q", opts.q);
    if (opts?.status) sp.set("status", opts.status);
    sp.set("limit", "300");

    const url = `/api/admin/anime${sp.toString() ? `?${sp.toString()}` : ""}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadGenres();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      load({
        q: query.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    }, 250);

    return () => clearTimeout(t);
  }, [query, statusFilter]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (item: AdminAnimeItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title ?? "",
      description: item.description ?? "",
      releaseYear: item.releaseYear != null ? String(item.releaseYear) : "",
      status: item.status ?? "ongoing",
      externalUrl: item.externalUrl ?? "",
      posterUrl: item.posterUrl ?? "",
      genres: Array.isArray(item.genres) ? item.genres : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleFormGenre = (name: string) => {
    setForm((p) => {
      const exists = p.genres.includes(name);
      const next = exists ? p.genres.filter((x) => x !== name) : [...p.genres, name];
      return { ...p, genres: next };
    });
  };

  const submit = async () => {
    const body = {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      releaseYear: form.releaseYear.trim() ? Number(form.releaseYear) : null,
      status: form.status.trim() || "ongoing",
      externalUrl: form.externalUrl.trim(),
      posterUrl: form.posterUrl.trim() ? form.posterUrl.trim() : null,
      genres: form.genres,
    };

    if (!body.title) return alert("Введите title");
    if (!body.externalUrl) return alert("Введите externalUrl (iframe url)");

    setSaving(true);

    const res = await fetch(editingId ? `/api/admin/anime/${editingId}` : "/api/admin/anime", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка сохранения");
      return;
    }

    await load({
      q: query.trim() || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
    startCreate();
  };

  const remove = async (id: number) => {
    if (!confirm("Удалить тайтл? Будут удалены рейтинги/статусы/изображения.")) return;

    const res = await fetch(`/api/admin/anime/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка удаления");
      return;
    }

    await load({
      q: query.trim() || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    });

    if (editingId === id) startCreate();
  };

  const formatRating = (v: number | null | undefined) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n.toFixed(1) : "0.0";
  };

  const hint = useMemo(() => {
    const parts: string[] = [];
    if (query.trim()) parts.push(`запрос: “${query.trim()}”`);
    if (statusFilter !== "all") {
      parts.push(
        `статус: ${STATUS_FILTERS.find((x) => x.value === statusFilter)?.label ?? statusFilter
        }`
      );
    }
    return parts.length ? parts.join(" • ") : "без фильтров";
  }, [query, statusFilter]);

  const filteredGenres = useMemo(() => {
    const q = genreSearch.trim().toLowerCase();
    if (!q) return allGenres;
    return allGenres.filter((g) => g.toLowerCase().includes(q));
  }, [allGenres, genreSearch]);

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
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-purple-200 backdrop-blur-md">
                Управление каталогом
              </div>

              <h1 className="mt-4 text-4xl font-bold text-white">Админ-панель</h1>
              <p className="mt-2 max-w-2xl text-gray-300">
                Создание, редактирование и удаление тайтлов.
                <span className="ml-2 text-gray-400">{hint}</span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск: название, описание, #42 или id42…"
                className="w-full rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-white outline-none transition placeholder:text-gray-400 focus:border-purple-400/60 md:w-80"
              />

              <div className="w-full md:w-44">
                <SelectMenu
                  value={statusFilter}
                  options={STATUS_OPTIONS}
                  onChange={(v) => setStatusFilter(v as (typeof STATUS_FILTERS)[number]["value"])}
                />
              </div>

              <button
                onClick={startCreate}
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white transition hover:bg-white/15 md:w-auto"
              >
                + Новый
              </button>
            </div>
          </div>

          <AdminSectionNav active="anime" />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {editingId ? `Редактирование #${editingId}` : "Новый тайтл"}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Заполни данные и сохрани изменения
                  </div>
                </div>

                {editingId && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-sm text-white transition hover:bg-white/12"
                  >
                    Сбросить
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <Field label="Название">
                  <input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                  />
                </Field>

                <Field label="Описание">
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Год">
                    <input
                      value={form.releaseYear}
                      onChange={(e) => setForm((p) => ({ ...p, releaseYear: e.target.value }))}
                      inputMode="numeric"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                    />
                  </Field>

                  <Field label="Статус">
                    <SelectMenu
                      value={form.status}
                      options={FORM_STATUS_OPTIONS}
                      onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                      buttonClassName="bg-black/20 border-white/10 hover:bg-black/25"
                    />
                  </Field>
                </div>

                <Field label="Жанры">
                  <input
                    value={genreSearch}
                    onChange={(e) => setGenreSearch(e.target.value)}
                    placeholder="Поиск жанра…"
                    className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-gray-400 focus:border-purple-400/50"
                  />
                  <div className="custom-dropdown-scroll max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                    {genresLoading ? (
                      <div className="text-sm text-gray-400">Загрузка жанров…</div>
                    ) : filteredGenres.length === 0 ? (
                      <div className="text-sm text-gray-400">Жанров пока нет. Добавь ниже.</div>
                    ) : (
                      filteredGenres.map((g) => {
                        const checked = form.genres.includes(g);
                        return (
                          <label
                            key={g}
                            className="flex cursor-pointer items-center gap-2 text-sm text-gray-200"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFormGenre(g)}
                              className="accent-purple-500"
                            />
                            <span className="truncate">{g}</span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      placeholder="Добавить жанр…"
                      className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-gray-400 focus:border-purple-400/50"
                    />
                    <button
                      type="button"
                      onClick={addGenre}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white transition hover:bg-white/15"
                    >
                      +
                    </button>
                  </div>
                </Field>

                <Field label="externalUrl (iframe)">
                  <input
                    value={form.externalUrl}
                    onChange={(e) => setForm((p) => ({ ...p, externalUrl: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                  />
                </Field>

                <Field label="posterUrl (опционально)">
                  <input
                    value={form.posterUrl}
                    onChange={(e) => setForm((p) => ({ ...p, posterUrl: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-purple-400/50"
                  />
                  <div className="mt-2 text-xs text-gray-400">
                    Оставь пустым, чтобы удалить или не задавать постер.
                  </div>
                </Field>

                <button
                  onClick={submit}
                  disabled={saving}
                  className="w-full rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 py-3 font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:from-purple-700 hover:to-violet-700 disabled:opacity-60"
                >
                  {saving ? "Сохраняю..." : editingId ? "Сохранить изменения" : "Создать"}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">Тайтлы</div>
                    <div className="mt-1 text-sm text-gray-400">
                      {loading ? "Обновляю список..." : `Найдено: ${items.length}`}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-gray-300">
                    Загрузка…
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-gray-300">
                    Ничего не найдено.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {items.map((a) => (
                      <div
                        key={a.id}
                        className="overflow-hidden rounded-[24px] border border-white/12 bg-white/[0.06] shadow-xl backdrop-blur-xl"
                      >
                        <div className="relative h-44 w-full bg-black/25">
                          {a.posterUrl ? (
                            <Image src={a.posterUrl} alt={a.title} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-gray-400">
                              No Image
                            </div>
                          )}

                          <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/90 backdrop-blur-md">
                            ★ {formatRating(a.rating)}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="line-clamp-1 text-lg font-semibold text-white">
                            {a.title}
                          </div>

                          <div className="mt-1 text-sm text-gray-400">
                            #{a.id} • {a.releaseYear ?? "—"} • {statusToRu(a.status)}
                          </div>

                          <div className="mt-3 line-clamp-2 text-sm text-gray-300">
                            {a.description ?? "Описание отсутствует"}
                          </div>

                          <div className="mt-3 text-xs text-gray-400">
                            Жанры:{" "}
                            <span className="text-gray-200">
                              {a.genres?.length ? a.genres.join(", ") : "—"}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                              onClick={() => startEdit(a)}
                              className="rounded-2xl border border-white/15 bg-white/10 py-2 text-white transition hover:bg-white/15"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => remove(a.id)}
                              className="rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 py-2 font-semibold text-white transition hover:from-red-600 hover:to-pink-600"
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 text-sm text-gray-400">
                Подсказка: если постеры с внешних доменов, добавь домен в{" "}
                <code>next.config.ts</code>.
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-sm text-gray-300">{label}</div>
      {children}
    </div>
  );
}