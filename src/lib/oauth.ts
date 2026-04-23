/** Утилиты для серверных компонентов: не тянут секреты на клиент. */

export function isGoogleOAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function isYandexOAuthConfigured(): boolean {
  return !!(
    process.env.YANDEX_CLIENT_ID?.trim() && process.env.YANDEX_CLIENT_SECRET?.trim()
  );
}

export function hasAnyOAuthProvider(): boolean {
  return isGoogleOAuthConfigured() || isYandexOAuthConfigured();
}
