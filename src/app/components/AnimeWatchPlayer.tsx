"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Minimize,
  Maximize,
  Pause,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";

type PlayerDubbing = {
  id: number;
  title: string;
  language: string;
  sortOrder: number;
  isDefault: boolean;
};

type PlayerEpisode = {
  id: number;
  dubbingId: number;
  episodeNumber: number;
  title: string | null;
  streamUrl: string;
  introStartSec: number | null;
  introEndSec: number | null;
  outroStartSec: number | null;
  outroEndSec: number | null;
  durationSec: number | null;
};

type PlayerSettings = {
  preferredDubbingId: number | null;
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
  autoNextEpisode: boolean;
};

type PlayerPayload = {
  dubbings: PlayerDubbing[];
  episodes: PlayerEpisode[];
  settings: PlayerSettings;
  progress: {
    episodeId: number;
    progressSec: number;
    updatedAt: string | Date;
  } | null;
};

type Props = {
  animeId: number;
  isAuthed: boolean;
  fallbackExternalUrl: string;
  fallbackTitle: string;
};

export default function AnimeWatchPlayer({
  animeId,
  isAuthed,
  fallbackExternalUrl,
  fallbackTitle,
}: Props) {
  const [loading, setLoading] = useState(isAuthed);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PlayerPayload | null>(null);
  const [playerMode, setPlayerMode] = useState<"new" | "legacy">("new");
  const [selectedDubbingId, setSelectedDubbingId] = useState<number | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(null);
  const [autoSkipIntro, setAutoSkipIntro] = useState(true);
  const [autoSkipOutro, setAutoSkipOutro] = useState(true);
  const [autoNextEpisode, setAutoNextEpisode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [centerOverlay, setCenterOverlay] = useState<"play" | "pause" | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openDubbingMenu, setOpenDubbingMenu] = useState(false);
  const [openEpisodeMenu, setOpenEpisodeMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSkipAtRef = useRef<{ intro: number; outro: number }>({ intro: 0, outro: 0 });
  const playOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pendingResumeSec, setPendingResumeSec] = useState<number | null>(null);
  const lastSavedProgressRef = useRef<number>(0);
  const lastProgressSaveAtRef = useRef<number>(0);
  const pendingAutoPlayNextRef = useRef(false);

  const load = async () => {
    if (!isAuthed) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/player/${animeId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить плеер");
      const data = (await res.json()) as PlayerPayload;
      setPayload(data);
      const progressEpisode = data.progress
        ? data.episodes.find((ep) => ep.id === data.progress?.episodeId)
        : null;

      if (progressEpisode) {
        setSelectedDubbingId(progressEpisode.dubbingId);
        setSelectedEpisodeId(progressEpisode.id);
        const resumeSec = Math.max(0, Number(data.progress?.progressSec ?? 0));
        setPendingResumeSec(resumeSec);
        lastSavedProgressRef.current = resumeSec;
      } else {
        setSelectedDubbingId(data.settings.preferredDubbingId);
        setPendingResumeSec(null);
        lastSavedProgressRef.current = 0;
      }
      setAutoSkipIntro(Boolean(data.settings.autoSkipIntro));
      setAutoSkipOutro(Boolean(data.settings.autoSkipOutro));
      setAutoNextEpisode(Boolean(data.settings.autoNextEpisode));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки плеера");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, isAuthed]);

  const episodes = useMemo(() => {
    if (!payload || !selectedDubbingId) return [];
    return payload.episodes.filter((x) => x.dubbingId === selectedDubbingId);
  }, [payload, selectedDubbingId]);

  useEffect(() => {
    if (!episodes.length) {
      setSelectedEpisodeId(null);
      return;
    }
    if (!selectedEpisodeId || !episodes.some((x) => x.id === selectedEpisodeId)) {
      setSelectedEpisodeId(episodes[0].id);
    }
  }, [episodes, selectedEpisodeId]);

  const selectedEpisode = useMemo(
    () => episodes.find((x) => x.id === selectedEpisodeId) ?? null,
    [episodes, selectedEpisodeId]
  );

  const saveSettings = async (next: Partial<PlayerSettings>) => {
    await fetch("/api/player/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  useEffect(() => {
    lastSkipAtRef.current = { intro: 0, outro: 0 };
    setVideoDurationSec(null);
    setCurrentTimeSec(0);
    setIsPlaying(false);
    setCenterOverlay(null);
    if (playOverlayTimeoutRef.current) {
      clearTimeout(playOverlayTimeoutRef.current);
      playOverlayTimeoutRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [selectedEpisodeId]);

  useEffect(() => {
    return () => {
      if (playOverlayTimeoutRef.current) clearTimeout(playOverlayTimeoutRef.current);
      void saveProgress(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      void saveProgress(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEpisodeId, animeId]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const onTimeUpdate = () => {
    const ep = selectedEpisode;
    const video = videoRef.current;
    if (!ep || !video) return;

    const t = video.currentTime;
    setCurrentTimeSec(t);
    const now = Date.now();

    if (
      autoSkipIntro &&
      ep.introStartSec !== null &&
      ep.introEndSec !== null &&
      ep.introEndSec > ep.introStartSec &&
      t >= ep.introStartSec &&
      t < ep.introEndSec &&
      now - lastSkipAtRef.current.intro > 500
    ) {
      video.currentTime = ep.introEndSec;
      lastSkipAtRef.current.intro = now;
      return;
    }

    if (
      autoSkipOutro &&
      ep.outroStartSec !== null &&
      ep.outroEndSec !== null &&
      ep.outroEndSec > ep.outroStartSec &&
      t >= ep.outroStartSec &&
      t < ep.outroEndSec &&
      now - lastSkipAtRef.current.outro > 500
    ) {
      video.currentTime = ep.outroEndSec;
      lastSkipAtRef.current.outro = now;
    }

    void saveProgress(false);
  };

  const formatTime = (sec: number) => {
    const safe = Math.max(0, Math.floor(sec));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const effectiveDuration = Number(selectedEpisode?.durationSec ?? videoDurationSec ?? 0);
  const progressPct =
    effectiveDuration > 0 ? Math.max(0, Math.min(100, (currentTimeSec / effectiveDuration) * 100)) : 0;

  const getSkipSegments = () => {
    if (!selectedEpisode) return [];

    const duration = Number(selectedEpisode.durationSec ?? videoDurationSec ?? 0);
    if (!duration || duration <= 0) return [];

    const segments: Array<{ type: "intro" | "outro"; leftPct: number; widthPct: number }> = [];

    const pushSegment = (type: "intro" | "outro", start: number | null, end: number | null) => {
      if (start === null || end === null || end <= start) return;
      const left = Math.max(0, Math.min(100, (start / duration) * 100));
      const right = Math.max(0, Math.min(100, (end / duration) * 100));
      const width = Math.max(0, right - left);
      if (width > 0) segments.push({ type, leftPct: left, widthPct: width });
    };

    pushSegment("intro", selectedEpisode.introStartSec, selectedEpisode.introEndSec);
    pushSegment("outro", selectedEpisode.outroStartSec, selectedEpisode.outroEndSec);

    return segments;
  };

  const skipSegments = getSkipSegments();

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  const saveProgress = async (force = false) => {
    const ep = selectedEpisode;
    const video = videoRef.current;
    if (!ep || !video) return;

    const current = Math.max(0, Math.floor(video.currentTime));
    const now = Date.now();
    const deltaSec = Math.abs(current - lastSavedProgressRef.current);
    const stale = now - lastProgressSaveAtRef.current > 10000;

    if (!force && deltaSec < 5 && !stale) return;

    await fetch("/api/player/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        animeId,
        episodeId: ep.id,
        progressSec: current,
        progressDurationSec:
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.floor(video.duration)
            : null,
      }),
    }).catch(() => null);

    lastSavedProgressRef.current = current;
    lastProgressSaveAtRef.current = now;
  };

  const handleSeek = (nextPct: number) => {
    const video = videoRef.current;
    if (!video || !effectiveDuration) return;
    const clamped = Math.max(0, Math.min(100, nextPct));
    const nextTime = (clamped / 100) * effectiveDuration;
    video.currentTime = nextTime;
    setCurrentTimeSec(nextTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
  };

  const changeVolume = (next: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, next));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped > 0 && muted) {
      video.muted = false;
      setMuted(false);
    }
  };

  const changeRate = (nextRate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const enterFullscreen = async () => {
    const root = wrapperRef.current;
    if (!root) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => null);
      return;
    }
    await root.requestFullscreen().catch(() => null);
  };

  const renderLegacyPlayer = () => (
    <div className="aspect-[16/10] w-full sm:aspect-video">
      {fallbackExternalUrl ? (
        <iframe
          src={fallbackExternalUrl}
          title={fallbackTitle}
          className="h-full w-full"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          allowFullScreen
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-gray-400">
          Публичный плеер пока недоступен для этого тайтла.
        </div>
      )}
    </div>
  );

  const selectedDubbing = payload?.dubbings.find((d) => d.id === selectedDubbingId) ?? null;

  if (!isAuthed) {
    return (
      renderLegacyPlayer()
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-2 backdrop-blur-xl">
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setPlayerMode("legacy")}
            className={`rounded-[18px] border px-4 py-3 text-left transition ${
              playerMode === "legacy"
                ? "border-purple-400/35 bg-gradient-to-br from-purple-500/25 to-violet-500/10"
                : "border-white/10 bg-black/10 hover:bg-white/[0.07]"
            }`}
          >
            <div className="text-sm font-semibold text-white">Обычный плеер</div>
            <div className="text-xs text-gray-400">Публичный iframe</div>
          </button>
          <button
            type="button"
            onClick={() => setPlayerMode("new")}
            className={`rounded-[18px] border px-4 py-3 text-left transition ${
              playerMode === "new"
                ? "border-purple-400/35 bg-gradient-to-br from-purple-500/25 to-violet-500/10"
                : "border-white/10 bg-black/10 hover:bg-white/[0.07]"
            }`}
          >
            <div className="text-sm font-semibold text-white">Плеер сайта</div>
            <div className="text-xs text-gray-400">Озвучки, серии, авто-скип</div>
          </button>
        </div>
      </div>

      {playerMode === "legacy" ? (
        renderLegacyPlayer()
      ) : (
        <>
          {!loading && !error && payload && payload.dubbings.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-gray-400">Озвучка</div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenDubbingMenu((prev) => !prev);
                    setOpenEpisodeMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-[#0d0d16] px-3 py-2 text-left text-white transition hover:border-purple-300/40"
                >
                  <span>{selectedDubbing?.title ?? "Выбери озвучку"}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openDubbingMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`absolute left-3 right-3 top-[78px] z-30 overflow-hidden rounded-xl border border-white/15 bg-[#0d0d16]/95 shadow-2xl backdrop-blur-md transition-all duration-200 ${
                    openDubbingMenu
                      ? "max-h-64 translate-y-0 opacity-100"
                      : "pointer-events-none max-h-0 -translate-y-1 opacity-0"
                  }`}
                >
                  <div className="custom-dropdown-scroll max-h-64 overflow-auto p-1">
                    {payload.dubbings.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={async () => {
                          setSelectedDubbingId(d.id);
                          setOpenDubbingMenu(false);
                          await saveSettings({ preferredDubbingId: d.id });
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedDubbingId === d.id
                            ? "bg-purple-500/25 text-white"
                            : "text-gray-200 hover:bg-white/10"
                        }`}
                      >
                        {d.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
                <div className="mb-2 text-xs uppercase tracking-[0.12em] text-gray-400">Серия</div>
                <button
                  type="button"
                  onClick={() => {
                    setOpenEpisodeMenu((prev) => !prev);
                    setOpenDubbingMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-[#0d0d16] px-3 py-2 text-left text-white transition hover:border-purple-300/40"
                >
                  <span>
                    {episodes.find((ep) => ep.id === selectedEpisodeId)
                      ? `${episodes.find((ep) => ep.id === selectedEpisodeId)?.episodeNumber}. ${
                        episodes.find((ep) => ep.id === selectedEpisodeId)?.title ||
                        `Эпизод ${episodes.find((ep) => ep.id === selectedEpisodeId)?.episodeNumber}`
                      }`
                      : "Выбери серию"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openEpisodeMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`absolute left-3 right-3 top-[78px] z-30 overflow-hidden rounded-xl border border-white/15 bg-[#0d0d16]/95 shadow-2xl backdrop-blur-md transition-all duration-200 ${
                    openEpisodeMenu
                      ? "max-h-64 translate-y-0 opacity-100"
                      : "pointer-events-none max-h-0 -translate-y-1 opacity-0"
                  }`}
                >
                  <div className="custom-dropdown-scroll max-h-64 overflow-auto p-1">
                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => {
                          setSelectedEpisodeId(ep.id);
                          setOpenEpisodeMenu(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          selectedEpisodeId === ep.id
                            ? "bg-purple-500/25 text-white"
                            : "text-gray-200 hover:bg-white/10"
                        }`}
                      >
                        {ep.episodeNumber}. {ep.title || `Эпизод ${ep.episodeNumber}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
          <div className="aspect-[16/10] w-full sm:aspect-video">
            {loading ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-6 text-sm text-gray-300">
                Загружаю персональный плеер...
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 px-6 text-sm text-rose-200">
                {error}
              </div>
            ) : !payload || payload.dubbings.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 px-6 text-sm text-gray-300">
                Для этого тайтла пока нет серий в новом плеере.
              </div>
            ) : selectedEpisode ? (
              <div ref={wrapperRef} className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video
                  ref={videoRef}
                  key={selectedEpisode.id}
                  src={selectedEpisode.streamUrl}
                  preload="metadata"
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget as HTMLVideoElement;
                    const d = Number(v.duration);
                    setVideoDurationSec(Number.isFinite(d) && d > 0 ? d : null);
                    const resume = pendingResumeSec ?? 0;
                    if (resume > 0) {
                      const maxSeek = Number.isFinite(d) && d > 0 ? Math.max(0, d - 1) : resume;
                      const target = Math.min(resume, maxSeek);
                      v.currentTime = target;
                      setCurrentTimeSec(target);
                      setPendingResumeSec(null);
                    } else {
                      setCurrentTimeSec(0);
                    }
                    setVolume(v.volume);
                    setMuted(v.muted);
                    if (pendingAutoPlayNextRef.current) {
                      pendingAutoPlayNextRef.current = false;
                      void v.play().catch(() => null);
                    }
                  }}
                  onPause={() => {
                    setIsPlaying(false);
                    void saveProgress(true);
                    setCenterOverlay("play");
                    if (playOverlayTimeoutRef.current) {
                      clearTimeout(playOverlayTimeoutRef.current);
                      playOverlayTimeoutRef.current = null;
                    }
                  }}
                  onPlay={() => {
                    setIsPlaying(true);
                    setCenterOverlay("pause");
                    if (playOverlayTimeoutRef.current) {
                      clearTimeout(playOverlayTimeoutRef.current);
                    }
                    playOverlayTimeoutRef.current = setTimeout(() => {
                      setCenterOverlay((prev) => (prev === "pause" ? null : prev));
                    }, 1000);
                  }}
                  onEnded={() => {
                    void saveProgress(true);
                    if (!autoNextEpisode) return;
                    const nextEpisode = episodes.find(
                      (ep) =>
                        selectedEpisode &&
                        ep.episodeNumber > selectedEpisode.episodeNumber
                    );
                    if (nextEpisode) {
                      pendingAutoPlayNextRef.current = true;
                      setSelectedEpisodeId(nextEpisode.id);
                    }
                  }}
                  onClick={() => void togglePlay()}
                  className="h-full w-full cursor-pointer bg-black"
                />

                {(centerOverlay === "play" || centerOverlay === "pause") && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={`rounded-full border border-white/20 bg-black/55 p-4 backdrop-blur-md ${
                        centerOverlay === "pause" ? "animate-pulse" : ""
                      }`}
                    >
                      {centerOverlay === "play" ? (
                        <Play className="h-8 w-8 text-white" />
                      ) : (
                        <Pause className="h-8 w-8 text-white" />
                      )}
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 to-transparent p-3">
                  <div className="mb-2">
                    <div
                      className="relative h-2 w-full cursor-pointer overflow-hidden rounded-full bg-white/20"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const pct = (x / rect.width) * 100;
                        handleSeek(pct);
                        void saveProgress(true);
                      }}
                    >
                      {skipSegments.map((seg, idx) => (
                        <div
                          key={`${seg.type}-${idx}`}
                          className={`absolute top-0 h-full ${
                            seg.type === "intro" ? "bg-amber-400/80" : "bg-cyan-400/80"
                          }`}
                          style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
                          title={seg.type === "intro" ? "Опенинг" : "Эндинг"}
                        />
                      ))}
                      <div
                        className="absolute left-0 top-0 h-full bg-white/90"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void togglePlay()}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                      className="w-24 accent-purple-500"
                    />

                    <div className="ml-1 text-xs text-gray-200">
                      {formatTime(currentTimeSec)} / {formatTime(effectiveDuration)}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSettings((prev) => !prev)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                      >
                        <Settings className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void enterFullscreen()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                      >
                        {isFullscreen ? (
                          <Minimize className="h-4 w-4" />
                        ) : (
                          <Maximize className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showSettings && (
                    <div className="absolute bottom-16 right-3 w-64 rounded-xl border border-white/20 bg-black/85 p-3 text-xs text-white backdrop-blur-md">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-gray-300">
                        Настройки плеера
                      </div>
                      <label className="mb-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoSkipIntro}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setAutoSkipIntro(checked);
                            await saveSettings({ autoSkipIntro: checked });
                          }}
                          className="accent-purple-500"
                        />
                        Авто-пропуск опенинга
                      </label>
                      <label className="mb-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoSkipOutro}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setAutoSkipOutro(checked);
                            await saveSettings({ autoSkipOutro: checked });
                          }}
                          className="accent-purple-500"
                        />
                        Авто-пропуск эндинга
                      </label>

                      <label className="mb-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={autoNextEpisode}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setAutoNextEpisode(checked);
                            await saveSettings({ autoNextEpisode: checked });
                          }}
                          className="accent-purple-500"
                        />
                        Следующая серия автоматически
                      </label>

                      <div className="text-[11px] text-gray-300">Скорость</div>
                      <div className="mt-2 grid grid-cols-4 gap-1">
                        {[0.75, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => changeRate(rate)}
                            className={`rounded-md border px-2 py-1 ${
                              playbackRate === rate
                                ? "border-purple-400/50 bg-purple-500/20 text-white"
                                : "border-white/20 bg-white/5 text-gray-200"
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-sm text-gray-400">
                Нет доступной серии.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
