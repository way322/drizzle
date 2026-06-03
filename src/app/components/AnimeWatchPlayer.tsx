"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Minimize,
  Maximize,
  Pause,
  Play,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  pickAutoQuality,
  type EpisodeQualityOption,
  type PreferredQuality,
  type QualityId,
} from "@/lib/videoQuality";

const SKIP_COUNTDOWN_SEC = 5;
const KEYBOARD_SEEK_STEP_SEC = 5;
const KEYBOARD_VOLUME_STEP = 0.05;
const MIN_PLAYBACK_RATE = 0.25;
const MAX_PLAYBACK_RATE = 2;
const PLAYBACK_RATE_STEP = 0.05;
const PLAYBACK_RATE_KEYBOARD_STEP = 0.25;

function formatPlaybackRate(rate: number) {
  const rounded = Math.round(rate * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/0$/, "")}x`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isPlayerKeyboardTarget(wrapper: HTMLElement | null) {
  if (!wrapper) return false;
  const active = document.activeElement;
  return active === wrapper || wrapper.contains(active);
}

type ActiveSkipSegment = {
  type: "intro" | "outro";
  endSec: number;
};

function getActiveSkipSegment(ep: PlayerEpisode, timeSec: number): ActiveSkipSegment | null {
  if (
    ep.introStartSec !== null &&
    ep.introEndSec !== null &&
    ep.introEndSec > ep.introStartSec &&
    timeSec >= ep.introStartSec &&
    timeSec < ep.introEndSec
  ) {
    return { type: "intro", endSec: ep.introEndSec };
  }

  if (
    ep.outroStartSec !== null &&
    ep.outroEndSec !== null &&
    ep.outroEndSec > ep.outroStartSec &&
    timeSec >= ep.outroStartSec &&
    timeSec < ep.outroEndSec
  ) {
    return { type: "outro", endSec: ep.outroEndSec };
  }

  return null;
}

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
  qualities: EpisodeQualityOption[];
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
  preferredQuality: PreferredQuality;
};

const QUALITY_ORDER: QualityId[] = ["1080", "720", "480"];

function getLowerQuality(current: QualityId, available: QualityId[]) {
  const idx = QUALITY_ORDER.indexOf(current);
  for (let i = idx + 1; i < QUALITY_ORDER.length; i++) {
    if (available.includes(QUALITY_ORDER[i])) return QUALITY_ORDER[i];
  }
  return null;
}

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
  const [preferredQuality, setPreferredQuality] = useState<PreferredQuality>("auto");
  const [autoQualityOverride, setAutoQualityOverride] = useState<QualityId | null>(null);
  const [networkHint, setNetworkHint] = useState<{
    effectiveType?: string;
    downlinkMbps?: number;
    saveData?: boolean;
  }>({});
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
  const [activeSkipSegment, setActiveSkipSegment] = useState<ActiveSkipSegment | null>(null);
  const [skipCountdownPct, setSkipCountdownPct] = useState(0);
  const [skipCountdownRunning, setSkipCountdownRunning] = useState(false);
  const skipCountdownRafRef = useRef<number | null>(null);
  const skipCountdownActiveRef = useRef(false);
  const autoSkipTriggeredRef = useRef<string | null>(null);
  const activeSkipSegmentRef = useRef<ActiveSkipSegment | null>(null);
  const episodesRef = useRef<PlayerEpisode[]>([]);
  const selectedEpisodeRef = useRef<PlayerEpisode | null>(null);
  const videoDurationSecRef = useRef<number | null>(null);
  const playbackRateRef = useRef(1);
  const playOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [pendingResumeSec, setPendingResumeSec] = useState<number | null>(null);
  const lastSavedProgressRef = useRef<number>(0);
  const lastProgressSaveAtRef = useRef<number>(0);
  const pendingAutoPlayNextRef = useRef(false);

  type WebkitFullscreenVideo = HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitDisplayingFullscreen?: boolean;
  };

  const load = async (silent = false) => {
    if (!isAuthed) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

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
      setPreferredQuality(data.settings.preferredQuality ?? "auto");
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки плеера");
      }
    } finally {
      if (!silent) setLoading(false);
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

  const qualityOptions = useMemo(
    () => selectedEpisode?.qualities ?? [],
    [selectedEpisode]
  );

  const availableQualityIds = useMemo(
    () => qualityOptions.map((q) => q.id),
    [qualityOptions]
  );

  const resolvedQualityId = useMemo(() => {
    if (!qualityOptions.length) return "1080" as QualityId;

    if (preferredQuality !== "auto") {
      if (qualityOptions.some((q) => q.id === preferredQuality)) return preferredQuality;
    }

    const autoBase = pickAutoQuality(qualityOptions, networkHint);
    if (preferredQuality === "auto" && autoQualityOverride) {
      const baseIdx = QUALITY_ORDER.indexOf(autoBase);
      const overrideIdx = QUALITY_ORDER.indexOf(autoQualityOverride);
      return overrideIdx > baseIdx ? autoQualityOverride : autoBase;
    }

    return autoBase;
  }, [qualityOptions, preferredQuality, networkHint, autoQualityOverride]);

  const activeStreamUrl = useMemo(() => {
    if (!selectedEpisode) return "";
    return (
      qualityOptions.find((q) => q.id === resolvedQualityId)?.streamUrl ??
      selectedEpisode.streamUrl
    );
  }, [selectedEpisode, qualityOptions, resolvedQualityId]);

  const changePreferredQuality = async (next: PreferredQuality) => {
    const video = videoRef.current;
    if (video && Number.isFinite(video.currentTime) && video.currentTime > 0) {
      setPendingResumeSec(video.currentTime);
    }
    setPreferredQuality(next);
    setAutoQualityOverride(null);
    await saveSettings({ preferredQuality: next });
  };

  useEffect(() => {
    setAutoQualityOverride(null);
  }, [selectedEpisodeId]);

  useEffect(() => {
    if (!isAuthed || playerMode !== "new" || !selectedEpisode) return;
    if (qualityOptions.length > 1) return;

    const timer = setInterval(() => {
      void load(true);
    }, 20000);

    return () => clearInterval(timer);
  }, [isAuthed, playerMode, selectedEpisodeId, qualityOptions.length]);

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          downlink?: number;
          saveData?: boolean;
          addEventListener?: (type: string, listener: () => void) => void;
          removeEventListener?: (type: string, listener: () => void) => void;
        };
      }
    ).connection;

    if (!connection) return;

    const update = () => {
      setNetworkHint({
        effectiveType: connection.effectiveType,
        downlinkMbps: typeof connection.downlink === "number" ? connection.downlink : undefined,
        saveData: connection.saveData,
      });
    };

    update();
    connection.addEventListener?.("change", update);
    return () => connection.removeEventListener?.("change", update);
  }, []);

  const saveSettings = async (next: Partial<PlayerSettings>) => {
    await fetch("/api/player/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  const cancelSkipCountdown = () => {
    if (skipCountdownRafRef.current !== null) {
      cancelAnimationFrame(skipCountdownRafRef.current);
      skipCountdownRafRef.current = null;
    }
    skipCountdownActiveRef.current = false;
    setSkipCountdownRunning(false);
    setSkipCountdownPct(0);
  };

  useEffect(() => {
    activeSkipSegmentRef.current = activeSkipSegment;
  }, [activeSkipSegment]);

  useEffect(() => {
    episodesRef.current = episodes;
  }, [episodes]);

  useEffect(() => {
    selectedEpisodeRef.current = selectedEpisode;
  }, [selectedEpisode]);

  useEffect(() => {
    videoDurationSecRef.current = videoDurationSec;
  }, [videoDurationSec]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  const performSegmentSkip = (segment: ActiveSkipSegment) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = segment.endSec;
    setCurrentTimeSec(segment.endSec);
    const now = Date.now();
    if (segment.type === "intro") {
      lastSkipAtRef.current.intro = now;
    } else {
      lastSkipAtRef.current.outro = now;
    }
    cancelSkipCountdown();
    setActiveSkipSegment(null);
    autoSkipTriggeredRef.current = null;
  };

  const startSkipCountdown = (segment: ActiveSkipSegment) => {
    if (skipCountdownActiveRef.current) return;

    skipCountdownActiveRef.current = true;
    setSkipCountdownRunning(true);
    setSkipCountdownPct(0);
    const startedAt = performance.now();
    const durationMs = SKIP_COUNTDOWN_SEC * 1000;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setSkipCountdownPct(pct);

      if (elapsed >= durationMs) {
        skipCountdownRafRef.current = null;
        skipCountdownActiveRef.current = false;
        performSegmentSkip(segment);
        return;
      }

      skipCountdownRafRef.current = requestAnimationFrame(() => tick(performance.now()));
    };

    skipCountdownRafRef.current = requestAnimationFrame(() => tick(performance.now()));
  };

  useEffect(() => {
    lastSkipAtRef.current = { intro: 0, outro: 0 };
    setVideoDurationSec(null);
    setCurrentTimeSec(0);
    setIsPlaying(false);
    setCenterOverlay(null);
    cancelSkipCountdown();
    setActiveSkipSegment(null);
    autoSkipTriggeredRef.current = null;
    setAutoQualityOverride(null);
    if (playOverlayTimeoutRef.current) {
      clearTimeout(playOverlayTimeoutRef.current);
      playOverlayTimeoutRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, [selectedEpisodeId]);

  useEffect(() => {
    return () => cancelSkipCountdown();
  }, []);

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

  useEffect(() => {
    const video = videoRef.current as WebkitFullscreenVideo | null;
    if (!video) return;

    const onWebkitBeginFullscreen = () => setIsFullscreen(true);
    const onWebkitEndFullscreen = () => setIsFullscreen(false);

    video.addEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen as EventListener);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen as EventListener);

    return () => {
      video.removeEventListener("webkitbeginfullscreen", onWebkitBeginFullscreen as EventListener);
      video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen as EventListener);
    };
  }, [selectedEpisodeId]);

  useEffect(() => {
    if (playerMode !== "new" || !selectedEpisodeId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const wrapper = wrapperRef.current;
      const video = videoRef.current;
      if (!wrapper || !video) return;
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      if (!isPlayerKeyboardTarget(wrapper)) return;

      const key = e.key;

      if (key === " " || key === "k" || key === "K") {
        e.preventDefault();
        void togglePlay();
        return;
      }

      if (key === "ArrowLeft") {
        e.preventDefault();
        seekRelative(-KEYBOARD_SEEK_STEP_SEC);
        return;
      }

      if (key === "ArrowRight") {
        e.preventDefault();
        seekRelative(KEYBOARD_SEEK_STEP_SEC);
        return;
      }

      if (key === "ArrowUp") {
        e.preventDefault();
        changeVolume(Math.min(1, video.volume + KEYBOARD_VOLUME_STEP));
        return;
      }

      if (key === "ArrowDown") {
        e.preventDefault();
        changeVolume(Math.max(0, video.volume - KEYBOARD_VOLUME_STEP));
        return;
      }

      if (key === "m" || key === "M") {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (key === "f" || key === "F") {
        e.preventDefault();
        void enterFullscreen();
        return;
      }

      if (key === "Escape" && document.fullscreenElement) {
        e.preventDefault();
        void document.exitFullscreen().catch(() => null);
        return;
      }

      if (key === "n" || key === "N") {
        e.preventDefault();
        switchEpisodeByStep(1);
        return;
      }

      if (key === "p" || key === "P") {
        e.preventDefault();
        switchEpisodeByStep(-1);
        return;
      }

      if (key === "s" || key === "S") {
        if (activeSkipSegmentRef.current) {
          e.preventDefault();
          performSegmentSkip(activeSkipSegmentRef.current);
        }
        return;
      }

      if (key === "<" || key === ",") {
        e.preventDefault();
        shiftPlaybackRate(-1);
        return;
      }

      if (key === ">" || key === ".") {
        e.preventDefault();
        shiftPlaybackRate(1);
        return;
      }

      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        const digit = Number(key);
        seekToPercent(digit === 0 ? 0 : digit * 10);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMode, selectedEpisodeId]);

  const onTimeUpdate = () => {
    const ep = selectedEpisode;
    const video = videoRef.current;
    if (!ep || !video) return;

    const t = video.currentTime;
    setCurrentTimeSec(t);

    const segment = getActiveSkipSegment(ep, t);
    if (!segment) {
      if (activeSkipSegmentRef.current) {
        cancelSkipCountdown();
        setActiveSkipSegment(null);
        autoSkipTriggeredRef.current = null;
      }
      void saveProgress(false);
      return;
    }

    const segmentKey = `${ep.id}:${segment.type}`;
    if (!activeSkipSegmentRef.current || activeSkipSegmentRef.current.type !== segment.type) {
      cancelSkipCountdown();
      setActiveSkipSegment(segment);
      autoSkipTriggeredRef.current = null;
    }

    const autoEnabled = segment.type === "intro" ? autoSkipIntro : autoSkipOutro;
    if (autoEnabled && autoSkipTriggeredRef.current !== segmentKey && !skipCountdownActiveRef.current) {
      autoSkipTriggeredRef.current = segmentKey;
      startSkipCountdown(segment);
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
  const skipCountdownRemainingSec = Math.max(
    0,
    Math.ceil(SKIP_COUNTDOWN_SEC - (skipCountdownPct / 100) * SKIP_COUNTDOWN_SEC)
  );
  const skipRingRadius = 18;
  const skipRingCircumference = 2 * Math.PI * skipRingRadius;
  const skipRingOffset =
    skipRingCircumference - (skipCountdownPct / 100) * skipRingCircumference;

  const handleSkipButtonClick = () => {
    if (!activeSkipSegment) return;
    performSegmentSkip(activeSkipSegment);
  };

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

  const getVideoDuration = () => {
    const video = videoRef.current;
    const fromMeta = Number(selectedEpisodeRef.current?.durationSec ?? videoDurationSecRef.current ?? 0);
    if (fromMeta > 0) return fromMeta;
    const fromVideo = Number(video?.duration ?? 0);
    return Number.isFinite(fromVideo) && fromVideo > 0 ? fromVideo : 0;
  };

  const seekRelative = (deltaSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const duration = getVideoDuration();
    const max = duration > 0 ? Math.max(0, duration - 0.25) : Number.POSITIVE_INFINITY;
    const next = Math.max(0, Math.min(max, video.currentTime + deltaSec));
    video.currentTime = next;
    setCurrentTimeSec(next);
    void saveProgress(true);
  };

  const seekToPercent = (pct: number) => {
    const video = videoRef.current;
    const duration = getVideoDuration();
    if (!video || duration <= 0) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const next = (clamped / 100) * duration;
    video.currentTime = next;
    setCurrentTimeSec(next);
    void saveProgress(true);
  };

  const switchEpisodeByStep = (step: 1 | -1) => {
    const current = selectedEpisodeRef.current;
    const list = episodesRef.current;
    if (!current || list.length === 0) return;

    const sorted = [...list].sort((a, b) => a.episodeNumber - b.episodeNumber);
    const idx = sorted.findIndex((ep) => ep.id === current.id);
    const next = sorted[idx + step];
    if (!next) return;

    void saveProgress(true);
    setSelectedEpisodeId(next.id);
  };

  const shiftPlaybackRate = (direction: -1 | 1) => {
    const current = playbackRateRef.current;
    const next = Math.max(
      MIN_PLAYBACK_RATE,
      Math.min(
        MAX_PLAYBACK_RATE,
        Math.round((current + direction * PLAYBACK_RATE_KEYBOARD_STEP) * 100) / 100
      )
    );
    changeRate(next);
  };

  const handleSeek = (nextPct: number) => {
    seekToPercent(nextPct);
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
    const clamped = Math.max(
      MIN_PLAYBACK_RATE,
      Math.min(MAX_PLAYBACK_RATE, Math.round(nextRate * 100) / 100)
    );
    video.playbackRate = clamped;
    setPlaybackRate(clamped);
  };

  const enterFullscreen = async () => {
    const root = wrapperRef.current;
    const video = videoRef.current as WebkitFullscreenVideo | null;
    if (!root) return;

    if (video?.webkitDisplayingFullscreen) {
      return;
    }

    if (
      !document.fullscreenElement &&
      typeof video?.webkitEnterFullscreen === "function"
    ) {
      video.webkitEnterFullscreen();
      setIsFullscreen(true);
      return;
    }

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
              <div
                ref={wrapperRef}
                tabIndex={0}
                onMouseDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button, input, textarea, select, a")) return;
                  wrapperRef.current?.focus({ preventScroll: true });
                }}
                className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black outline-none focus-visible:ring-2 focus-visible:ring-purple-400/35"
              >
                <video
                  ref={videoRef}
                  key={`${selectedEpisode.id}-${resolvedQualityId}`}
                  src={activeStreamUrl}
                  preload="metadata"
                  playsInline
                  onTimeUpdate={onTimeUpdate}
                  onWaiting={() => {
                    if (preferredQuality !== "auto") return;
                    const lower = getLowerQuality(resolvedQualityId, availableQualityIds);
                    if (lower) setAutoQualityOverride(lower);
                  }}
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

                {activeSkipSegment && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipButtonClick();
                    }}
                    className="absolute bottom-20 right-3 z-30 flex items-center gap-2 rounded-2xl border border-white/20 bg-black/45 px-3 py-2 text-white shadow-lg backdrop-blur-md transition hover:border-purple-300/40 hover:bg-purple-500/20"
                    title={
                      activeSkipSegment.type === "intro"
                        ? "Пропустить опенинг"
                        : "Пропустить эндинг"
                    }
                  >
                    <span className="relative inline-flex h-11 w-11 items-center justify-center">
                      <svg
                        className="absolute inset-0 h-11 w-11 -rotate-90"
                        viewBox="0 0 44 44"
                        aria-hidden
                      >
                        <circle
                          cx="22"
                          cy="22"
                          r={skipRingRadius}
                          fill="none"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r={skipRingRadius}
                          fill="none"
                          stroke="rgba(168,85,247,0.95)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={skipRingCircumference}
                          strokeDashoffset={skipRingOffset}
                          className="transition-[stroke-dashoffset] duration-75"
                        />
                      </svg>
                      <SkipForward className="relative h-4 w-4" />
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-xs font-semibold">
                        {activeSkipSegment.type === "intro" ? "Опенинг" : "Эндинг"}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {skipCountdownRunning
                          ? skipCountdownRemainingSec > 0
                            ? `Пропуск через ${skipCountdownRemainingSec}с`
                            : "Пропуск..."
                          : "Нажми — пропустить сразу"}
                      </span>
                    </span>
                  </button>
                )}

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

                      <div className="mb-3">
                        <div className="mb-2 text-[11px] text-gray-300">Качество видео</div>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => void changePreferredQuality("auto")}
                            className={`rounded-md border px-2 py-1.5 text-[11px] ${
                              preferredQuality === "auto"
                                ? "border-purple-400/50 bg-purple-500/20 text-white"
                                : "border-white/20 bg-white/5 text-gray-200"
                            }`}
                          >
                            Авто
                            {preferredQuality === "auto" ? ` (${resolvedQualityId}p)` : ""}
                          </button>
                          {qualityOptions.map((q) => (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => void changePreferredQuality(q.id)}
                              className={`rounded-md border px-2 py-1.5 text-[11px] ${
                                preferredQuality === q.id
                                  ? "border-purple-400/50 bg-purple-500/20 text-white"
                                  : "border-white/20 bg-white/5 text-gray-200"
                              }`}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                        {qualityOptions.length < 3 && (
                          <p className="mt-2 text-[10px] leading-4 text-gray-400">
                            720p и 480p создаются после загрузки серии (обновление каждые 20 сек).
                          </p>
                        )}
                      </div>

                      <div className="mb-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-gray-300">Скорость</div>
                          <div className="text-xs font-medium tabular-nums text-white">
                            {formatPlaybackRate(playbackRate)}
                          </div>
                        </div>
                        <input
                          type="range"
                          min={MIN_PLAYBACK_RATE}
                          max={MAX_PLAYBACK_RATE}
                          step={PLAYBACK_RATE_STEP}
                          value={playbackRate}
                          onChange={(e) => changeRate(Number(e.target.value))}
                          className="w-full accent-purple-500"
                        />
                        <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                          <span>0.25x</span>
                          <span>2x</span>
                        </div>
                      </div>

                      <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] leading-5 text-gray-300">
                        <div className="mb-1 font-semibold text-gray-200">Горячие клавиши</div>
                        <div>← / → — ±5 сек</div>
                        <div>↑ / ↓ — громкость</div>
                        <div>Пробел / K — пауза</div>
                        <div>M — звук, F — полный экран</div>
                        <div>N / P — серия, S — пропуск оп/эд</div>
                        <div>0–9 — позиция, &lt; &gt; — скорость ±0.25</div>
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
