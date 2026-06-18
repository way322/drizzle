import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { withRole } from "../../../../../server/services/userService";
import { buildEpisodeObjectKey } from "../../../../../lib/s3ObjectKey";
import {
  buildClientS3Url,
  getS3Bucket,
  getS3Client,
  getS3ConfigErrorMessage,
} from "../../../../../lib/s3";

export const POST = withRole("admin", async (req) => {
  try {
    const body = await req.json().catch(() => null);
    const animeId = Number(body?.animeId);
    const dubbingId = Number(body?.dubbingId);
    const episodeNumber = Number(body?.episodeNumber);
    const fileName = String(body?.fileName ?? "episode.mp4").trim();
    const objectKeyRaw = String(body?.objectKey ?? "").trim();
    const contentType = String(body?.contentType ?? "video/mp4").trim() || "video/mp4";

    if (!Number.isInteger(animeId) || !Number.isInteger(dubbingId) || !Number.isInteger(episodeNumber)) {
      return NextResponse.json({ error: "animeId, dubbingId and episodeNumber are required" }, { status: 400 });
    }

    const objectKey =
      objectKeyRaw ||
      buildEpisodeObjectKey({
        animeId,
        dubbingId,
        episodeNumber,
        fileName: fileName || "episode.mp4",
      });
    const bucket = getS3Bucket();
    const client = getS3Client();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return NextResponse.json({
      uploadUrl,
      objectKey,
      streamUrl: buildClientS3Url(objectKey),
      expiresInSec: 900,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `S3 не настроен: ${getS3ConfigErrorMessage(err)}. Проверь .env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_PUBLIC_BASE_URL).`,
      },
      { status: 400 }
    );
  }
});
