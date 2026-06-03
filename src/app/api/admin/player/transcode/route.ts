import { NextResponse } from "next/server";

import { withRole } from "../../../../../server/services/userService";
import { transcodeEpisodeVariants } from "../../../../../server/services/videoTranscode";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withRole("admin", async (req) => {
  try {
    const body = await req.json().catch(() => null);
    const episodeId = Number(body?.episodeId);
    const waitForFinish = Boolean(body?.wait);

    if (!Number.isInteger(episodeId)) {
      return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
    }

    if (waitForFinish) {
      const result = await transcodeEpisodeVariants(episodeId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        variants: result.variants,
        warnings: result.warnings ?? null,
      });
    }

    void transcodeEpisodeVariants(episodeId)
      .then((result) => {
        if (!result.ok) {
          console.error(`[transcode] episode ${episodeId} failed:`, result.error);
          return;
        }
        if (result.warnings?.length) {
          console.warn(`[transcode] episode ${episodeId} warnings:`, result.warnings);
        }
        console.log(`[transcode] episode ${episodeId} done`);
      })
      .catch((err) => {
        console.error(`[transcode] episode ${episodeId} crashed:`, err);
      });

    return NextResponse.json({
      success: true,
      started: true,
      message:
        "Транскод запущен в фоне (1–5 мин). Обновите страницу тайтла — появятся 720p и 480p.",
    });
  } catch (err) {
    console.error("[transcode] route error:", err);
    const message = err instanceof Error ? err.message : "Internal transcode error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
