"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";

import SelectMenu, { type SelectOption } from "./SelectMenu";

type WatchStatus = "watching" | "planned" | "dropped" | "completed";

type Props = {
  animeId: number;
  initialStatus: WatchStatus | null;
  initialRating: number | null;
  initialLoved: boolean;
};

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Не выбран" },
  { value: "watching", label: "Смотрю" },
  { value: "planned", label: "Запланировано" },
  { value: "completed", label: "Просмотрено" },
  { value: "dropped", label: "Брошено" },
];

const RATING_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Без оценки" },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

async function sendJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const err = new Error("AUTH_REQUIRED");
    (err as Error & { code?: string }).code = "AUTH_REQUIRED";
    throw err;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      (payload && typeof payload.error === "string" && payload.error) ||
      (await res.text().catch(() => "")) ||
      "Не удалось выполнить запрос";
    throw new Error(message);
  }

  return res;
}

export default function AnimeUserActions({
  animeId,
  initialStatus,
  initialRating,
  initialLoved,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<string>(initialStatus ?? "");
  const [rating, setRating] = useState<string>(
    initialRating ? String(initialRating) : ""
  );
  const [loved, setLoved] = useState(initialLoved);

  const [favoritePending, setFavoritePending] = useState(false);
  const [statusPending, startStatusTransition] = useTransition();
  const [ratingPending, startRatingTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleAuthRequired = () => {
    const callbackUrl = encodeURIComponent(pathname || "/");
    router.push(`/auth/login?callbackUrl=${callbackUrl}`);
  };

  const handleToggleFavorite = async () => {
    clearMessages();
    setFavoritePending(true);

    try {
      const nextLoved = !loved;

      await sendJson("/api/user/loved", {
        animeId,
        loved: nextLoved,
      });

      setLoved(nextLoved);
      setSuccess(nextLoved ? "Добавлено в любимое" : "Удалено из любимого");
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
        handleAuthRequired();
        return;
      }
      setError(e instanceof Error ? e.message : "Ошибка при обновлении избранного");
    } finally {
      setFavoritePending(false);
    }
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    clearMessages();

    startStatusTransition(async () => {
      try {
        await sendJson("/api/user/anime-status", {
          animeId,
          status: value || "none",
        });

        setSuccess("Статус сохранён");
      } catch (e) {
        if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
          handleAuthRequired();
          return;
        }
        setError(e instanceof Error ? e.message : "Ошибка при сохранении статуса");
      }
    });
  };

  const handleRatingChange = (value: string) => {
    setRating(value);
    clearMessages();

    startRatingTransition(async () => {
      try {
        await sendJson("/api/user/rating", {
          animeId,
          value: value === "" ? null : Number(value),
        });

        setSuccess(value === "" ? "Оценка удалена" : "Оценка сохранена");
      } catch (e) {
        if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
          handleAuthRequired();
          return;
        }
        setError(e instanceof Error ? e.message : "Ошибка при сохранении оценки");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-white">Любимое</div>
            <div className="mt-1 text-xs text-gray-400">
              Сохраняется в базе в таблицу favorites
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={favoritePending}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
              loved
                ? "border-pink-400/30 bg-pink-500/15 text-pink-100 hover:bg-pink-500/20"
                : "border-white/15 bg-white/8 text-white hover:bg-white/12"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {favoritePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${loved ? "fill-current" : ""}`} />
            )}
            {loved ? "В любимом" : "В любимое"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">Мой список</div>
            {statusPending && (
              <div className="inline-flex items-center gap-2 text-xs text-purple-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Сохраняется...
              </div>
            )}
          </div>

          <SelectMenu
            value={status}
            options={STATUS_OPTIONS}
            onChange={handleStatusChange}
            placeholder="Выбери статус"
            className="w-full"
            buttonClassName="bg-white/[0.06] hover:bg-white/[0.1] border-white/10 rounded-2xl"
            menuClassName="border-white/10 bg-[#0b0b14]/95"
          />
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-white">Моя оценка (1–10)</div>
            {ratingPending && (
              <div className="inline-flex items-center gap-2 text-xs text-amber-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Сохраняется...
              </div>
            )}
          </div>

          <SelectMenu
            value={rating}
            options={RATING_OPTIONS}
            onChange={handleRatingChange}
            placeholder="Поставить оценку"
            className="w-full"
            align="right"
            buttonClassName="bg-white/[0.06] hover:bg-white/[0.1] border-white/10 rounded-2xl"
            menuClassName="border-white/10 bg-[#0b0b14]/95"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </div>
      )}
    </div>
  );
}