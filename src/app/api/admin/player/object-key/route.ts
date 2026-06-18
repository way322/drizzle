import { NextResponse } from "next/server";

import { buildEpisodeObjectKey } from "../../../../../lib/s3ObjectKey";
import { buildClientS3Url, getS3ConfigErrorMessage } from "../../../../../lib/s3";
import { withRole } from "../../../../../server/services/userService";

export const POST = withRole("admin", async (req) => {
  try {
    const body = await req.json().catch(() => null);
    const objectKeyRaw = String(body?.objectKey ?? "").trim();

    if (objectKeyRaw) {
      return NextResponse.json({
        objectKey: objectKeyRaw,
        streamUrl: buildClientS3Url(objectKeyRaw),
      });
    }

    const animeId = Number(body?.animeId);
    const dubbingId = Number(body?.dubbingId);
    const episodeNumber = Number(body?.episodeNumber);
    const fileName = String(body?.fileName ?? "").trim() || null;
    const title = String(body?.title ?? "").trim() || null;

    if (!Number.isInteger(animeId) || !Number.isInteger(dubbingId) || !Number.isInteger(episodeNumber)) {
      return NextResponse.json(
        { error: "animeId, dubbingId and episodeNumber are required (or pass objectKey)" },
        { status: 400 }
      );
    }

    const objectKey = buildEpisodeObjectKey({
      animeId,
      dubbingId,
      episodeNumber,
      fileName,
      title,
    });

    return NextResponse.json({
      objectKey,
      streamUrl: buildClientS3Url(objectKey),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `S3 не настроен: ${getS3ConfigErrorMessage(err)}. Проверь .env (S3_PUBLIC_BASE_URL и остальные S3_*).`,
      },
      { status: 400 }
    );
  }
});
