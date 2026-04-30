"use client";

import { useMemo, useState } from "react";

type Dubbing = {
  id: number;
  title: string;
  language: string;
  sortOrder: number;
  isDefault: boolean;
};

type Episode = {
  id: number;
  dubbingId: number;
  episodeNumber: number;
  title: string | null;
  streamUrl: string;
  objectKey: string;
  introStartSec: number | null;
  introEndSec: number | null;
  outroStartSec: number | null;
  outroEndSec: number | null;
  durationSec: number | null;
};

type AnimePayload = {
  anime: { id: number; title: string };
  dubbings: Dubbing[];
  episodes: Episode[];
};

export default function AdminPlayerClient() {
  const [animeIdInput, setAnimeIdInput] = useState("");
  const [payload, setPayload] = useState<AnimePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dubTitle, setDubTitle] = useState("");
  const [dubLanguage, setDubLanguage] = useState("ru");
  const [dubDefault, setDubDefault] = useState(false);

  const [epDubbingId, setEpDubbingId] = useState("");
  const [epNumber, setEpNumber] = useState("");
  const [epTitle, setEpTitle] = useState("");
  const [epObjectKey, setEpObjectKey] = useState("");
  const [epStreamUrl, setEpStreamUrl] = useState("");
  const [lastPickedFileName, setLastPickedFileName] = useState("");
  const [uploadedFor, setUploadedFor] = useState<{
    animeId: number;
    dubbingId: number;
    episodeNumber: number;
  } | null>(null);
  const [introStart, setIntroStart] = useState("");
  const [introEnd, setIntroEnd] = useState("");
  const [outroStart, setOutroStart] = useState("");
  const [outroEnd, setOutroEnd] = useState("");
  const [editingEpisodeId, setEditingEpisodeId] = useState<number | null>(null);

  const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const generateObjectKey = () => {
    if (!payload || !epDubbingId || !epNumber) {
      setError("Сначала выбери тайтл, озвучку и номер серии");
      return;
    }
    const animeId = payload.anime.id;
    const dubbingId = Number(epDubbingId);
    const episodeNumber = Number(epNumber);
    const fileName = sanitizeFileName((lastPickedFileName || "episode.mp4").trim());
    const stamp = Date.now();
    setEpObjectKey(
      `anime/${animeId}/dubbing/${dubbingId}/episode-${episodeNumber}/${stamp}-${fileName}`
    );
    setMessage("Object key сгенерирован");
    setError(null);
  };

  const currentAnimeId = Number(animeIdInput);
  const canLoadAnime = Number.isInteger(currentAnimeId);

  const activeDubbings = payload?.dubbings ?? [];

  const resetEpisodeForm = () => {
    setEpNumber("");
    setEpTitle("");
    setEpObjectKey("");
    setEpStreamUrl("");
    setIntroStart("");
    setIntroEnd("");
    setOutroStart("");
    setOutroEnd("");
    setUploadedFor(null);
    setEditingEpisodeId(null);
  };

  const startEditEpisode = (ep: Episode) => {
    setEpDubbingId(String(ep.dubbingId));
    setEpNumber(String(ep.episodeNumber));
    setEpTitle(ep.title ?? "");
    setEpObjectKey(ep.objectKey ?? "");
    setEpStreamUrl(ep.streamUrl ?? "");
    setIntroStart(ep.introStartSec != null ? String(ep.introStartSec) : "");
    setIntroEnd(ep.introEndSec != null ? String(ep.introEndSec) : "");
    setOutroStart(ep.outroStartSec != null ? String(ep.outroStartSec) : "");
    setOutroEnd(ep.outroEndSec != null ? String(ep.outroEndSec) : "");
    setEditingEpisodeId(ep.id);
    setMessage(`Режим изменения: эпизод ${ep.episodeNumber}`);
    setError(null);
  };

  const episodesByDubbing = useMemo(() => {
    const activeEpisodes = payload?.episodes ?? [];
    const map = new Map<number, Episode[]>();
    for (const ep of activeEpisodes) {
      const list = map.get(ep.dubbingId) ?? [];
      list.push(ep);
      map.set(ep.dubbingId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.episodeNumber - b.episodeNumber);
    }
    return map;
  }, [payload]);

  const loadAnime = async () => {
    if (!canLoadAnime) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    const res = await fetch(`/api/admin/player/anime?animeId=${currentAnimeId}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setPayload(null);
      setError(data.error ?? "Не удалось загрузить данные");
      return;
    }

    setPayload(data as AnimePayload);
    setMessage("Данные плеера загружены");
    if ((data as AnimePayload).dubbings[0]?.id) {
      setEpDubbingId(String((data as AnimePayload).dubbings[0].id));
    }
  };

  const createDubbing = async () => {
    if (!payload) return;
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/player/dubbings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId: payload.anime.id,
        title: dubTitle,
        language: dubLanguage,
        isDefault: dubDefault,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не удалось создать озвучку");
      return;
    }
    setDubTitle("");
    setDubDefault(false);
    await loadAnime();
  };

  const uploadToS3 = async (file: File) => {
    if (!payload || !epDubbingId || !epNumber) return;
    setError(null);
    setMessage(null);

    const urlRes = await fetch("/api/admin/player/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId: payload.anime.id,
        dubbingId: Number(epDubbingId),
        episodeNumber: Number(epNumber),
        fileName: file.name,
        contentType: file.type || "video/mp4",
      }),
    });
    const urlData = await urlRes.json().catch(() => ({}));
    if (!urlRes.ok) {
      setError(urlData.error ?? "Не удалось получить upload URL");
      return;
    }

    const putRes = await fetch(String(urlData.uploadUrl), {
      method: "PUT",
      headers: { "Content-Type": file.type || "video/mp4" },
      body: file,
    });
    if (!putRes.ok) {
      setError("Ошибка загрузки файла в S3");
      return;
    }

    setEpObjectKey(String(urlData.objectKey ?? ""));
    setEpStreamUrl(String(urlData.streamUrl ?? ""));
    setUploadedFor({
      animeId: payload.anime.id,
      dubbingId: Number(epDubbingId),
      episodeNumber: Number(epNumber),
    });
    setMessage("Видео загружено в S3. Сохрани серию.");
  };

  const saveEpisode = async () => {
    if (!payload) return;
    setError(null);
    setMessage(null);

    const body = {
      animeId: payload.anime.id,
      dubbingId: Number(epDubbingId),
      episodeNumber: Number(epNumber),
      title: epTitle || null,
      objectKey: epObjectKey || null,
      streamUrl: epStreamUrl || null,
      introStartSec: introStart || null,
      introEndSec: introEnd || null,
      outroStartSec: outroStart || null,
      outroEndSec: outroEnd || null,
    };

    const isSameUploadedTarget =
      uploadedFor &&
      uploadedFor.animeId === payload.anime.id &&
      uploadedFor.dubbingId === Number(epDubbingId) &&
      uploadedFor.episodeNumber === Number(epNumber);

    if (!isSameUploadedTarget && !epStreamUrl.trim()) {
      setError(
        "Для этой озвучки/серии сначала загрузи файл в S3 (или укажи корректный Stream URL), потом сохраняй."
      );
      return;
    }

    const res = await fetch("/api/admin/player/episodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить серию");
      return;
    }
    setMessage("Серия сохранена");
    setEditingEpisodeId(null);
    await loadAnime();
  };

  const deleteEpisode = async (episodeId: number) => {
    if (!confirm("Удалить серию?")) return;
    const res = await fetch(`/api/admin/player/episodes?episodeId=${episodeId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось удалить серию");
      return;
    }
    await loadAnime();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
        <div className="text-lg font-semibold text-white">1) Выбери тайтл</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={animeIdInput}
            onChange={(e) => setAnimeIdInput(e.target.value)}
            placeholder="ID аниме (например 42)"
            className="w-72 rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-white outline-none placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={loadAnime}
            disabled={!canLoadAnime || loading}
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? "Загрузка..." : "Загрузить"}
          </button>
        </div>
        {payload && (
          <div className="mt-3 text-sm text-gray-300">
            Тайтл: #{payload.anime.id} {payload.anime.title}
          </div>
        )}
      </div>

      {payload && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
              <div className="text-lg font-semibold text-white">2) Добавить озвучку</div>
              <div className="mt-3 space-y-3">
                <input
                  value={dubTitle}
                  onChange={(e) => setDubTitle(e.target.value)}
                  placeholder="Название озвучки"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <input
                  value={dubLanguage}
                  onChange={(e) => setDubLanguage(e.target.value)}
                  placeholder="Язык (ru, en...)"
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={dubDefault}
                    onChange={(e) => setDubDefault(e.target.checked)}
                    className="accent-purple-500"
                  />
                  Сделать основной озвучкой
                </label>
                <button
                  type="button"
                  onClick={createDubbing}
                  className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 font-semibold text-white"
                >
                  Добавить озвучку
                </button>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
              <div className="text-lg font-semibold text-white">Озвучки тайтла</div>
              <div className="mt-3 space-y-2">
                {activeDubbings.length === 0 ? (
                  <div className="text-sm text-gray-400">Озвучек пока нет</div>
                ) : (
                  activeDubbings.map((d) => (
                    <div key={d.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200">
                      #{d.id} {d.title} ({d.language}) {d.isDefault ? "• default" : ""}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-white">
                {editingEpisodeId ? "3) Изменить серию" : "3) Добавить / обновить серию"}
              </div>
              {editingEpisodeId && (
                <button
                  type="button"
                  onClick={resetEpisodeForm}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/15"
                >
                  Отменить изменение
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <select
                value={epDubbingId}
                onChange={(e) => setEpDubbingId(e.target.value)}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              >
                <option value="">Озвучка</option>
                {activeDubbings.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <input
                value={epNumber}
                onChange={(e) => setEpNumber(e.target.value)}
                placeholder="Номер серии"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                value={epTitle}
                onChange={(e) => setEpTitle(e.target.value)}
                placeholder="Название серии (опц.)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm text-gray-300">Загрузка видео в S3</div>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLastPickedFileName(file.name);
                    void uploadToS3(file);
                  }
                }}
                className="mt-2 text-sm text-gray-300"
              />
              {lastPickedFileName && (
                <div className="mt-1 text-xs text-gray-400">Файл: {lastPickedFileName}</div>
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={epObjectKey}
                onChange={(e) => setEpObjectKey(e.target.value)}
                placeholder="S3 object key"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                value={epStreamUrl}
                onChange={(e) => setEpStreamUrl(e.target.value)}
                placeholder="Stream URL (если без S3)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={generateObjectKey}
                className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/15"
              >
                Сгенерировать key
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <input
                value={introStart}
                onChange={(e) => setIntroStart(e.target.value)}
                placeholder="Intro start (56 или 2:32)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                value={introEnd}
                onChange={(e) => setIntroEnd(e.target.value)}
                placeholder="Intro end (56 или 2 32)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                value={outroStart}
                onChange={(e) => setOutroStart(e.target.value)}
                placeholder="Outro start (56 или 2:32)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
              <input
                value={outroEnd}
                onChange={(e) => setOutroEnd(e.target.value)}
                placeholder="Outro end (56 или 2 32)"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
              />
            </div>

            <button
              type="button"
              onClick={saveEpisode}
              className="mt-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 font-semibold text-white"
            >
              {editingEpisodeId ? "Сохранить изменения" : "Сохранить серию"}
            </button>
          </div>

          <div className="rounded-[30px] border border-white/12 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-xl">
            <div className="text-lg font-semibold text-white">Серии</div>
            <div className="mt-3 space-y-3">
              {activeDubbings.map((d) => (
                <div key={d.id}>
                  <div className="mb-2 text-sm font-medium text-purple-100">{d.title}</div>
                  <div className="space-y-2">
                    {(episodesByDubbing.get(d.id) ?? []).map((ep) => (
                      <div key={ep.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm text-white">
                          {ep.episodeNumber}. {ep.title || `Эпизод ${ep.episodeNumber}`}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-400">{ep.streamUrl}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          intro: {ep.introStartSec ?? "-"} - {ep.introEndSec ?? "-"} | outro:{" "}
                          {ep.outroStartSec ?? "-"} - {ep.outroEndSec ?? "-"}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditEpisode(ep)}
                          className="mt-2 mr-2 rounded-xl border border-sky-400/20 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEpisode(ep.id)}
                          className="mt-2 rounded-xl bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                    {(episodesByDubbing.get(d.id) ?? []).length === 0 && (
                      <div className="text-sm text-gray-400">Серий нет</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}
    </div>
  );
}
