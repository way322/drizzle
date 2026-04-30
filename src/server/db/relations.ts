// src/server/db/relations.ts
import { relations } from "drizzle-orm";
import {
  users,
  anime,
  studios,
  genres,
  ratings,
  favorites,
  animeGenres,
  animeImages,
  userAnimeStatus,
  comments,
  commentVotes,
  commentReports,
  animeDubbings,
  animeEpisodes,
  userPlayerSettings,
  userAnimeProgress,
} from "./schema";

// USERS
export const userRelations = relations(users, ({ many }) => ({
  ratings: many(ratings),
  favorites: many(favorites),
  statuses: many(userAnimeStatus),
  comments: many(comments),
  commentVotes: many(commentVotes),
  commentReports: many(commentReports),
  playerSettings: many(userPlayerSettings),
  animeProgress: many(userAnimeProgress),
}));

// STUDIOS
export const studioRelations = relations(studios, ({ many }) => ({
  anime: many(anime),
}));

// ANIME
export const animeRelations = relations(anime, ({ many, one }) => ({
  studio: one(studios, {
    fields: [anime.studioId],
    references: [studios.id],
  }),
  ratings: many(ratings),
  genres: many(animeGenres),
  images: many(animeImages),
  favorites: many(favorites),
  userStatuses: many(userAnimeStatus),
  comments: many(comments),
  dubbings: many(animeDubbings),
  episodes: many(animeEpisodes),
  progress: many(userAnimeProgress),
}));

// GENRES
export const genreRelations = relations(genres, ({ many }) => ({
  anime: many(animeGenres),
}));

// ✅ USER_ANIME_STATUS
export const userAnimeStatusRelations = relations(userAnimeStatus, ({ one }) => ({
  user: one(users, {
    fields: [userAnimeStatus.userId],
    references: [users.id],
  }),
  anime: one(anime, {
    fields: [userAnimeStatus.animeId],
    references: [anime.id],
  }),
}));

export const commentRelations = relations(comments, ({ one, many }) => ({
  anime: one(anime, {
    fields: [comments.animeId],
    references: [anime.id],
  }),
  author: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: "comment_replies",
  }),
  replies: many(comments, { relationName: "comment_replies" }),
  votes: many(commentVotes),
  reports: many(commentReports),
}));

export const commentVoteRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentVotes.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentVotes.userId],
    references: [users.id],
  }),
}));

export const commentReportRelations = relations(commentReports, ({ one }) => ({
  comment: one(comments, {
    fields: [commentReports.commentId],
    references: [comments.id],
  }),
  reporter: one(users, {
    fields: [commentReports.reporterId],
    references: [users.id],
  }),
  handledBy: one(users, {
    fields: [commentReports.handledByUserId],
    references: [users.id],
  }),
}));

export const animeDubbingRelations = relations(animeDubbings, ({ one, many }) => ({
  anime: one(anime, {
    fields: [animeDubbings.animeId],
    references: [anime.id],
  }),
  episodes: many(animeEpisodes),
  userPreferredBy: many(userPlayerSettings),
}));

export const animeEpisodeRelations = relations(animeEpisodes, ({ one, many }) => ({
  anime: one(anime, {
    fields: [animeEpisodes.animeId],
    references: [anime.id],
  }),
  dubbing: one(animeDubbings, {
    fields: [animeEpisodes.dubbingId],
    references: [animeDubbings.id],
  }),
  progress: many(userAnimeProgress),
}));

export const userPlayerSettingsRelations = relations(userPlayerSettings, ({ one }) => ({
  user: one(users, {
    fields: [userPlayerSettings.userId],
    references: [users.id],
  }),
  preferredDubbing: one(animeDubbings, {
    fields: [userPlayerSettings.preferredDubbingId],
    references: [animeDubbings.id],
  }),
}));

export const userAnimeProgressRelations = relations(userAnimeProgress, ({ one }) => ({
  user: one(users, {
    fields: [userAnimeProgress.userId],
    references: [users.id],
  }),
  anime: one(anime, {
    fields: [userAnimeProgress.animeId],
    references: [anime.id],
  }),
  episode: one(animeEpisodes, {
    fields: [userAnimeProgress.episodeId],
    references: [animeEpisodes.id],
  }),
}));
