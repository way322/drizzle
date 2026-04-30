# Kitsune — аниме-каталог с душой (и плеером)

Привет. Это **Kitsune** — сайт, где можно листать каталог аниме, ставить статусы, собирать «любимое», оставлять комментарии и **смотреть серии** в своём плеере, если ты залогинен. Админка позволяет наполнять каталог, крутить жанры, модерировать комментарии и заливать видео в S3/MinIO.

Коротко, что внутри:

- **Каталог и фильтры** — жанры, поиск, удобные чекбоксы (в т.ч. поиск по жанрам).
- **Аккаунты** — регистрация, вход по паролю, опционально Google и Яндекс (NextAuth).
- **Профиль** — списки, рейтинги, **«продолжить просмотр»** с красивой карточкой и прогрессом, загрузка **аватара** в хранилище.
- **Страница тайтла** — постер, описание, кастомный **видеоплеер**: дубляжи, серии, скип интро/аутро, автоследующая серия, настройки пользователя.
- **Комментарии** — вложенные ответы, лайки/дизлайки, жалобы, фильтр мата, **редактирование** своего комментария; админ и автор могут **удалить**.
- **Админка** — отдельные разделы для аниме, плеера и модерации комментариев (баны на 1/7/14 дней и т.д.).

Стек: **Next.js 16**, **React 19**, **Tailwind**, **Drizzle + Postgres**, **NextAuth**, **S3-совместимое хранилище**. Для продакшена удобно собрать **`npm run build`** и гонять **`npm run start`** (особенно если сайт торчит наружу через туннель — dev-режим с HMR там часто капризничает).

---

## Быстрый старт локально

Скопируй `.env.example` → `.env`, заполни как минимум `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

```bash
npm install
npm run db:migrate
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000). На Windows по умолчанию **`npm run dev` идёт через Webpack** — Turbopack иногда подвисает; если хочется именно он: `npm run dev:turbo`.

## Docker «всё в одном»

Postgres, миграции, приложение в production-режиме:

```bash
docker compose up --build
```

Сайт: [http://localhost:3000](http://localhost:3000). БД с хоста: `localhost:5432`, пользователь `kitsune`, пароль `kitsune`, база `kitsune`.

Если миграции когда-то ругались — можно сбросить том и поднять заново:

```bash
docker compose down -v
docker compose up --build
```

Образ Node по умолчанию тянется с **`mirror.gcr.io/library/node:20-alpine`** (реже ловим TLS timeout до Docker Hub). Нужен классический Hub — в `.env` задай `NODE_IMAGE=node:20-alpine`.

**OAuth:** в `.env` пары `GOOGLE_*` и при желании `YANDEX_*`. Callback’и в консолях провайдеров: `{NEXTAUTH_URL}/api/auth/callback/google` и `.../callback/yandex`.

## Сид данных (`sql.sql`)

Это не миграции Drizzle, а готовые `INSERT`’ы. Порядок строгий: **сначала миграции**, потом `sql.sql`.

- Профиль `seed` в compose: `docker compose --profile seed up --build` или `docker compose --profile seed up seed`.
- Или вручную в уже поднятую БД:  
  `docker compose exec -T db psql -U kitsune -d kitsune < sql.sql`  
  В PowerShell:  
  `Get-Content -Path .\sql.sql -Raw -Encoding utf8 | docker compose exec -T db psql -U kitsune -d kitsune`

В конце `sql.sql` может быть тестовый админ — смотри комментарии в файле и `.env.example`; пароль после первого импорта лучше сменить.

## Скрипты

| Команда | Зачем |
|--------|--------|
| `npm run dev` | разработка |
| `npm run build` / `npm run start` | прод-сборка |
| `npm run db:migrate` | применить миграции |
| `npm run db:generate` | сгенерить миграции после правок схемы |
| `npm run db:studio` | Drizzle Studio |

## Деплой в двух фразах

Собери образ при необходимости: `docker build -t kitsune --target runner .`  
На серере выставь переменные как в `.env.example`; для облачного Postgres с TLS — `DATABASE_SSL=require` или `?sslmode=require` в URL. Миграции один раз: `npm run db:migrate` с боевым `DATABASE_URL`.

---

*Удачного просмотра — и пусть интро будет коротким.*
