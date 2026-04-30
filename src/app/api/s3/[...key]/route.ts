import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

import { getS3Bucket, getS3Client } from "../../../../lib/s3";

type RouteCtx = { params: Promise<{ key: string[] }> };

function getHeaderValue(value: unknown) {
  if (value == null) return null;
  return String(value);
}

export async function GET(req: Request, routeCtx: RouteCtx) {
  const params = routeCtx ? await routeCtx.params : null;
  const key = (params?.key ?? []).join("/");
  if (!key) {
    return NextResponse.json({ error: "Missing object key" }, { status: 400 });
  }

  const bucket = getS3Bucket();
  const s3 = getS3Client();
  const range = req.headers.get("range") ?? undefined;

  try {
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: range,
      })
    );

    if (!object.Body) {
      return NextResponse.json({ error: "File body is empty" }, { status: 404 });
    }

    const headers = new Headers();
    const contentType = getHeaderValue(object.ContentType);
    const contentLength = getHeaderValue(object.ContentLength);
    const contentRange = getHeaderValue(object.ContentRange);

    if (contentType) headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=300");

    const body = object.Body as
      | { transformToWebStream?: () => ReadableStream<Uint8Array> }
      | Readable;

    const stream =
      typeof (body as { transformToWebStream?: unknown }).transformToWebStream === "function"
        ? (body as { transformToWebStream: () => ReadableStream<Uint8Array> }).transformToWebStream()
        : (Readable.toWeb(body as Readable) as unknown as ReadableStream<Uint8Array>);

    return new NextResponse(stream, { status: range ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "S3 object not found" }, { status: 404 });
  }
}
