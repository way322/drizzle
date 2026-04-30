// src/server/db/schema.ts
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  provider: varchar("provider", { length: 20 }).notNull().default("local"),
  providerId: varchar("provider_id", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("user"), // ✅ ДОБАВИЛИ
  commentBanUntil: timestamp("comment_ban_until"),
  createdAt: timestamp("created_at").defaultNow(),
});


// STUDIOS
export const studios = pgTable("studios", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  country: varchar("country", { length: 50 }),
});

// GENRES
export const genres = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});

// ANIME
export const anime = pgTable("anime", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  studioId: integer("studio_id").references(() => studios.id),
  releaseYear: integer("release_year"),
  status: varchar("status", { length: 20 }).default("ongoing"),
  externalUrl: text("external_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ANIME <-> GENRES
export const animeGenres = pgTable("anime_genres", {
  animeId: integer("anime_id")
    .references(() => anime.id)
    .notNull(),
  genreId: integer("genre_id")
    .references(() => genres.id)
    .notNull(),
});

// IMAGES
export const animeImages = pgTable("anime_images", {
  id: serial("id").primaryKey(),
  animeId: integer("anime_id")
    .references(() => anime.id)
    .notNull(),
  imageUrl: text("image_url").notNull(),
  isPoster: boolean("is_poster").default(false),
});

// ✅ USER LISTS / WATCH STATUS
export const userAnimeStatus = pgTable(
  "user_anime_status",
  {
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    // watching | planned | dropped | completed
    status: varchar("status", { length: 20 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.animeId] }),
  })
);

// RATINGS
export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    value: integer("value").notNull(),
  },
  (t) => ({
    userAnimeUnique: uniqueIndex("ratings_user_anime_unique").on(
      t.userId,
      t.animeId
    ),
  })
);

// FAVORITES
export const favorites = pgTable(
  "favorites",
  {
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    userAnimeUnique: uniqueIndex("favorites_user_anime_unique").on(
      t.userId,
      t.animeId
    ),
  })
);

// COMMENTS
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    parentCommentId: integer("parent_comment_id").references((): AnyPgColumn => comments.id),
    content: text("content").notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    animeIdIdx: index("comments_anime_id_idx").on(t.animeId),
  })
);

export const commentVotes = pgTable(
  "comment_votes",
  {
    commentId: integer("comment_id")
      .references(() => comments.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    value: integer("value").notNull(), // 1 | -1
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.commentId, t.userId] }),
  })
);

export const commentReports = pgTable(
  "comment_reports",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id")
      .references(() => comments.id)
      .notNull(),
    reporterId: integer("reporter_id")
      .references(() => users.id)
      .notNull(),
    reason: text("reason"),
    status: varchar("status", { length: 20 }).notNull().default("open"), // open | resolved | dismissed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    handledByUserId: integer("handled_by_user_id").references(() => users.id),
  },
  (t) => ({
    reportUnique: uniqueIndex("comment_reports_comment_reporter_unique").on(
      t.commentId,
      t.reporterId
    ),
    statusIdx: index("comment_reports_status_idx").on(t.status),
  })
);

// PLAYER DUBBINGS
export const animeDubbings = pgTable(
  "anime_dubbings",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    language: varchar("language", { length: 20 }).notNull().default("ru"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    animeIdx: index("anime_dubbings_anime_idx").on(t.animeId),
  })
);

// PLAYER EPISODES
export const animeEpisodes = pgTable(
  "anime_episodes",
  {
    id: serial("id").primaryKey(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    dubbingId: integer("dubbing_id")
      .references(() => animeDubbings.id)
      .notNull(),
    episodeNumber: integer("episode_number").notNull(),
    title: varchar("title", { length: 180 }),
    objectKey: text("object_key").notNull(),
    streamUrl: text("stream_url").notNull(),
    introStartSec: integer("intro_start_sec"),
    introEndSec: integer("intro_end_sec"),
    outroStartSec: integer("outro_start_sec"),
    outroEndSec: integer("outro_end_sec"),
    durationSec: integer("duration_sec"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    animeDubEpisodeUnique: uniqueIndex("anime_episodes_anime_dub_episode_unique").on(
      t.animeId,
      t.dubbingId,
      t.episodeNumber
    ),
    animeIdx: index("anime_episodes_anime_idx").on(t.animeId),
  })
);

// USER PLAYER SETTINGS
export const userPlayerSettings = pgTable("user_player_settings", {
  userId: integer("user_id")
    .references(() => users.id)
    .notNull()
    .primaryKey(),
  preferredDubbingId: integer("preferred_dubbing_id").references(() => animeDubbings.id),
  autoSkipIntro: boolean("auto_skip_intro").notNull().default(true),
  autoSkipOutro: boolean("auto_skip_outro").notNull().default(true),
  autoNextEpisode: boolean("auto_next_episode").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userAnimeProgress = pgTable(
  "user_anime_progress",
  {
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    animeId: integer("anime_id")
      .references(() => anime.id)
      .notNull(),
    episodeId: integer("episode_id")
      .references(() => animeEpisodes.id)
      .notNull(),
    progressSec: integer("progress_sec").notNull().default(0),
    progressDurationSec: integer("progress_duration_sec"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.animeId] }),
    userUpdatedIdx: index("user_anime_progress_user_updated_idx").on(t.userId, t.updatedAt),
  })
);
