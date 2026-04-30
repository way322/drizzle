import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import { withAuth } from "../../../../../server/services/userService";
import { db } from "../../../../../server/db";
import { users } from "../../../../../server/db/schema";
import {
  buildClientS3Url,
  deleteS3Object,
  extractObjectKeyFromS3Url,
  getS3Bucket,
  getS3Client,
  getS3ConfigErrorMessage,
} from "../../../../../lib/s3";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export const POST = withAuth(async (req, ctx) => {
  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, ctx.userId),
      columns: { avatarUrl: true },
    });

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const fileName = sanitizeFileName(file.name || "avatar.png");
    const contentType = file.type || "application/octet-stream";
    const objectKey = `avatars/user-${ctx.userId}/${Date.now()}-${fileName}`;

    const bucket = getS3Bucket();
    const client = getS3Client();
    const bytes = Buffer.from(await file.arrayBuffer());

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: bytes,
        ContentType: contentType,
      })
    );

    const avatarUrl = buildClientS3Url(objectKey);
    await db.update(users).set({ avatarUrl }).where(eq(users.id, ctx.userId));

    const oldObjectKey = extractObjectKeyFromS3Url(existingUser?.avatarUrl);
    if (oldObjectKey && oldObjectKey !== objectKey) {
      await deleteS3Object(oldObjectKey).catch(() => null);
    }

    return NextResponse.json({ success: true, avatarUrl, objectKey });
  } catch (err) {
    return NextResponse.json(
      { error: `S3 upload error: ${getS3ConfigErrorMessage(err)}` },
      { status: 400 }
    );
  }
});
