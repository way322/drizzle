/**
 * Проверка env при старте production-сервера (см. instrumentation.ts).
 * Локально: NODE_ENV=development — проверка не выполняется.
 * Сборка Docker: SKIP_ENV_VALIDATION=1 отключает проверку на этапе next build.
 */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.SKIP_ENV_VALIDATION === "1") return;

  const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;
  const missing = required.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `[env] В продакшене задайте: ${missing.join(", ")}. См. .env.example и docker-compose.yml`
    );
  }
}
