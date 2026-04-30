import { S3Client } from "@aws-sdk/client-s3";

function getOptional(name: string) {
  return process.env[name]?.trim() || "";
}

function required(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing env: ${name}`);
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

function withDevFallback(name: string, fallback: string) {
  if (isProd()) return required(name);
  return required(name, fallback);
}

export function getS3Config() {
  const endpoint = withDevFallback("S3_ENDPOINT", "http://127.0.0.1:9000");
  const region = getOptional("S3_REGION") || "us-east-1";
  const bucket = withDevFallback("S3_BUCKET", "anime-videos");
  const accessKey = withDevFallback("S3_ACCESS_KEY", "minioadmin");
  const secretKey = withDevFallback("S3_SECRET_KEY", "minioadmin");
  const publicBaseUrl =
    getOptional("S3_PUBLIC_BASE_URL") || `${endpoint.replace(/\/+$/, "")}/${bucket}`;

  return { endpoint, region, bucket, accessKey, secretKey, publicBaseUrl };
}

export function getS3ConfigErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return "S3 config error";
}

export function validateS3Config() {
  const cfg = getS3Config();
  if (!/^https?:\/\//i.test(cfg.endpoint)) {
    throw new Error("S3_ENDPOINT must start with http:// or https://");
  }
  if (!/^https?:\/\//i.test(cfg.publicBaseUrl)) {
    throw new Error("S3_PUBLIC_BASE_URL must start with http:// or https://");
  }
  return cfg;
}

export function getS3Bucket() {
  return validateS3Config().bucket;
}

export function getPublicS3BaseUrl() {
  return validateS3Config().publicBaseUrl.replace(/\/+$/, "");
}

export function buildPublicS3Url(objectKey: string) {
  const key = objectKey.replace(/^\/+/, "");
  return `${getPublicS3BaseUrl()}/${key}`;
}

function toProxyPathFromObjectKey(objectKey: string) {
  const key = objectKey
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/s3/${key}`;
}

function isLocalHostName(hostname: string) {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function tryExtractObjectKeyFromUrl(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    if (!isLocalHostName(u.hostname)) return null;
    const bucket = getS3Bucket();
    const path = u.pathname.replace(/^\/+/, "");
    if (path.startsWith(`${bucket}/`)) {
      return path.slice(bucket.length + 1);
    }
    return path || null;
  } catch {
    return null;
  }
}

export function buildClientS3Url(objectKey: string) {
  const publicBase = getPublicS3BaseUrl();
  try {
    const baseUrl = new URL(publicBase);
    if (isLocalHostName(baseUrl.hostname)) {
      return toProxyPathFromObjectKey(objectKey);
    }
  } catch {
    return toProxyPathFromObjectKey(objectKey);
  }
  return buildPublicS3Url(objectKey);
}

export function resolveClientAssetUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return null;
  const key = tryExtractObjectKeyFromUrl(rawUrl);
  if (key) return toProxyPathFromObjectKey(key);
  return rawUrl;
}

export function getS3Client() {
  const cfg = validateS3Config();
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKey,
      secretAccessKey: cfg.secretKey,
    },
  });
}

export function getS3DebugConfigForLogs() {
  const cfg = validateS3Config();
  return {
    endpoint: cfg.endpoint,
    region: cfg.region,
    bucket: cfg.bucket,
    publicBaseUrl: cfg.publicBaseUrl,
  };
}
