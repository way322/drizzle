import { NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { withRole } from "../../../../../server/services/userService";
import { buildEpisodeObjectKey } from "../../../../../lib/s3ObjectKey";
import {
  buildClientS3Url,
  getS3Bucket,
  getS3Client,
  getS3ConfigErrorMessage,
} from "../../../../../lib/s3";

export const maxDuration = 300;
export const runtime = "nodejs";

export const POST = withRole("admin", async (req) => {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const animeId = Number(form.get("animeId"));
    const dubbingId = Number(form.get("dubbingId"));
    const episodeNumber = Number(form.get("episodeNumber"));
    const objectKeyRaw = String(form.get("objectKey") ?? "").trim();
    const fileName = String(form.get("fileName") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!Number.isInteger(animeId) || !Number.isInteger(dubbingId) || !Number.isInteger(episodeNumber)) {
      return NextResponse.json(
        { error: "animeId, dubbingId and episodeNumber are required" },
        { status: 400 }
      );
    }

    const objectKey =
      objectKeyRaw ||
      buildEpisodeObjectKey({
        animeId,
        dubbingId,
        episodeNumber,
        fileName: fileName || file.name || "episode.mp4",
      });

    const contentType = file.type || "video/mp4";
    const bucket = getS3Bucket();
    const client = getS3Client();
    const body = Readable.fromWeb(file.stream() as unknown as NodeReadableStream);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        ...(file.size > 0 ? { ContentLength: file.size } : {}),
      })
    );

    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    return NextResponse.json({
      objectKey,
      streamUrl: buildClientS3Url(objectKey),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Не удалось загрузить в S3: ${getS3ConfigErrorMessage(err)}` },
      { status: 400 }
    );
  }
});
