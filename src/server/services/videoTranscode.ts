import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";

import {
  buildQualityObjectKey,
  parseStreamVariants,
  type QualityId,
  type StreamVariantsMap,
} from "../../lib/videoQuality";
import { resolveFfmpegBin } from "../../lib/ffmpeg";
import {
  downloadS3ObjectToFile,
  extractObjectKeyFromS3Url,
  s3ObjectExists,
  uploadS3Object,
} from "../../lib/s3";
import { db } from "../db";
import { animeEpisodes } from "../db/schema";

const TRANSCODE_TARGETS: Array<{ id: QualityId; height: number }> = [
  { id: "720", height: 720 },
  { id: "480", height: 480 },
];

function getTranscodeEnv() {
  const threads = Math.max(1, Math.min(8, Number(process.env.FFMPEG_THREADS ?? 2) || 2));
  const nice = Math.max(0, Math.min(19, Number(process.env.FFMPEG_NICE ?? 12) || 12));
  const preset = process.env.FFMPEG_PRESET?.trim() || "fast";
  const pauseMs = Math.max(0, Number(process.env.TRANSCODE_PAUSE_MS ?? 3000) || 3000);
  return { threads, nice, preset, pauseMs };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeObjectKey(raw: string) {
  const trimmed = raw.trim();
  return extractObjectKeyFromS3Url(trimmed) ?? trimmed.replace(/^\/+/, "");
}

function spawnFfmpeg(bin: string, ffmpegArgs: string[]) {
  const { nice } = getTranscodeEnv();
  if (process.platform === "linux" && nice > 0) {
    return spawn("nice", ["-n", String(nice), bin, ...ffmpegArgs], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  }
  return spawn(bin, ffmpegArgs, { stdio: ["ignore", "ignore", "pipe"] });
}

function runProcess(bin: string, args: string[], timeoutMs = 30 * 60 * 1000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawnFfmpeg(bin, args);
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Таймаут ${Math.round(timeoutMs / 60000)} мин (${bin})`));
    }, timeoutMs);

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(
          new Error(
            "ffmpeg не найден на сервере. Установите ffmpeg (в Docker: apk add ffmpeg) или задайте FFMPEG_PATH."
          )
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${bin} завершился с кодом ${code}`));
    });
  });
}

export async function assertFfmpegAvailable() {
  const bin = await resolveFfmpegBin();
  try {
    await runProcess(bin, ["-version"], 15000);
  } catch (err) {
    const extra = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${extra}. Путь: ${bin}. Задайте FFMPEG_PATH (Docker: /usr/bin/ffmpeg) и пересоберите образ.`
    );
  }
}

async function transcodeToHeight(inputPath: string, outputPath: string, height: number) {
  const bin = await resolveFfmpegBin();
  const { threads, preset } = getTranscodeEnv();
  await runProcess(bin, [
    "-y",
    "-threads",
    String(threads),
    "-i",
    inputPath,
    "-vf",
    `scale=-2:${height}`,
    "-c:v",
    "libx264",
    "-preset",
    preset,
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

function resolveSourceKey(raw: string) {
  return normalizeObjectKey(raw);
}

export async function transcodeEpisodeVariants(episodeId: number) {
  const episode = await db.query.animeEpisodes.findFirst({
    where: eq(animeEpisodes.id, episodeId),
    columns: {
      id: true,
      objectKey: true,
      streamVariants: true,
    },
  });

  if (!episode?.objectKey?.trim()) {
    return { ok: false as const, error: "У серии не указан исходный файл (object_key)" };
  }

  const sourceKey = resolveSourceKey(episode.objectKey);
  if (!sourceKey) {
    return { ok: false as const, error: "Некорректный путь к видео в S3" };
  }

  let existing: StreamVariantsMap = {};
  if (episode.streamVariants) {
    try {
      existing = parseStreamVariants(JSON.parse(episode.streamVariants));
    } catch {
      existing = {};
    }
  }

  const variants: StreamVariantsMap = {
    "1080": sourceKey,
    ...existing,
  };

  let tmpDir = "";

  try {
    await assertFfmpegAvailable();

    const sourceExists = await s3ObjectExists(sourceKey);
    if (!sourceExists) {
      return {
        ok: false as const,
        error: `Исходное видео не найдено в S3: ${sourceKey}`,
      };
    }

    const transcodeEnv = getTranscodeEnv();
    console.info(
      `[transcode] episode ${episodeId} settings: threads=${transcodeEnv.threads}, nice=${transcodeEnv.nice} (linux only), preset=${transcodeEnv.preset}, pauseMs=${transcodeEnv.pauseMs}`
    );

    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kitsune-transcode-"));
    const localInputPath = path.join(tmpDir, "source.mp4");

    await downloadS3ObjectToFile(sourceKey, localInputPath);
    const stat = await fs.stat(localInputPath);
    if (stat.size < 1024) {
      return { ok: false as const, error: "Скачанный файл пустой или слишком маленький" };
    }

    const errors: string[] = [];
    const { pauseMs } = getTranscodeEnv();
    let encodedCount = 0;

    for (const target of TRANSCODE_TARGETS) {
      const targetKey = buildQualityObjectKey(sourceKey, target.id);
      variants[target.id] = targetKey;

      if (await s3ObjectExists(targetKey)) continue;

      if (encodedCount > 0 && pauseMs > 0) {
        await sleep(pauseMs);
      }

      const outputPath = path.join(tmpDir, `${target.id}.mp4`);
      try {
        await transcodeToHeight(localInputPath, outputPath, target.height);
        encodedCount += 1;
        const outStat = await fs.stat(outputPath);
        if (outStat.size < 1024) {
          throw new Error("пустой результат");
        }
        const outputBuffer = await fs.readFile(outputPath);
        await uploadS3Object({
          objectKey: targetKey,
          body: outputBuffer,
          contentType: "video/mp4",
        });
        await fs.unlink(outputPath).catch(() => null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ошибка ffmpeg";
        errors.push(`${target.id}p: ${msg}`);
      }
    }

    const createdAny =
      (await s3ObjectExists(buildQualityObjectKey(sourceKey, "720"))) ||
      (await s3ObjectExists(buildQualityObjectKey(sourceKey, "480")));

    if (!createdAny && errors.length > 0) {
      return { ok: false as const, error: errors.join(" | ") };
    }

    await db
      .update(animeEpisodes)
      .set({
        streamVariants: JSON.stringify(variants),
        objectKey: sourceKey,
        updatedAt: new Date(),
      })
      .where(eq(animeEpisodes.id, episodeId));

    return {
      ok: true as const,
      variants,
      warnings: errors.length > 0 ? errors : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcode failed";
    return { ok: false as const, error: message };
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}
