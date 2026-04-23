import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/** Локальный Postgres без SSL: по умолчанию ssl: false. Облако: DATABASE_SSL или sslmode в URL. */
function resolveSsl(): boolean | "require" {
  const flag = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (flag === "require" || flag === "true" || flag === "1") return "require";
  if (flag === "false" || flag === "0" || flag === "disable") return false;

  const url = process.env.DATABASE_URL ?? "";
  if (/sslmode=require|ssl=true/i.test(url)) return "require";

  return false;
}

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  ssl: resolveSsl(),
});

export const db = drizzle(client, {
  schema,
});
