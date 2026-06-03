import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

let cachedBin: string | null = null;

async function isExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getFfmpegStaticPath() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    return typeof ffmpegStatic === "string" && ffmpegStatic.trim() ? ffmpegStatic.trim() : null;
  } catch {
    return null;
  }
}

export async function resolveFfmpegBin() {
  if (cachedBin) return cachedBin;

  const candidates: string[] = [];

  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) candidates.push(fromEnv);

  const bundled = getFfmpegStaticPath();
  if (bundled) candidates.push(bundled);

  candidates.push(
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg.exe")
  );

  if (process.platform === "linux") {
    candidates.push("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg");
  }
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg");
  }
  if (process.platform === "win32") {
    candidates.push("C:\\ffmpeg\\bin\\ffmpeg.exe");
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (await isExecutable(candidate)) {
      cachedBin = candidate;
      return candidate;
    }
  }

  cachedBin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return cachedBin;
}
