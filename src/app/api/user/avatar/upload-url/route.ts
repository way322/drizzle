import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { withAuth } from "../../../../../server/services/userService";
import {
  buildClientS3Url,
  getS3Bucket,
  getS3Client,
  getS3ConfigErrorMessage,
} from "../../../../../lib/s3";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export const POST = withAuth(async (req, ctx) => {
  try {
    const body = await req.json().catch(() => null);
    const fileName = sanitizeFileName(String(body?.fileName ?? "avatar.png").trim() || "avatar.png");
    const contentType = String(body?.contentType ?? "image/png").trim() || "image/png";

    const objectKey = `avatars/user-${ctx.userId}/${Date.now()}-${fileName}`;
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
      avatarUrl: buildClientS3Url(objectKey),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `S3 не настроен: ${getS3ConfigErrorMessage(err)}` },
      { status: 400 }
    );
  }
});
