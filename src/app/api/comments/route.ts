import { NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../../server/db";
import { comments, commentVotes, users } from "../../../server/db/schema";
import { sanitizeCommentText } from "../../../lib/profanity";
import { withAuth } from "../../../server/services/userService";
import { resolveClientAssetUrl } from "../../../lib/s3";

const MAX_COMMENT_LEN = 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const animeId = Number(searchParams.get("animeId"));
  const userId = Number(searchParams.get("userId"));

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: comments.id,
      animeId: comments.animeId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userId: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      parentCommentId: comments.parentCommentId,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(and(eq(comments.animeId, animeId), eq(comments.isDeleted, false)))
    .orderBy(asc(comments.createdAt));

  const commentIds = rows.map((x) => x.id);
  const voteStats = commentIds.length
    ? await db
      .select({
        commentId: commentVotes.commentId,
        likes: sql<number>`count(*) filter (where ${commentVotes.value} = 1)::int`.as("likes"),
        dislikes: sql<number>`count(*) filter (where ${commentVotes.value} = -1)::int`.as("dislikes"),
      })
      .from(commentVotes)
      .where(inArray(commentVotes.commentId, commentIds))
      .groupBy(commentVotes.commentId)
    : [];

  const userVotes =
    Number.isSafeInteger(userId) && commentIds.length
      ? await db
        .select({
          commentId: commentVotes.commentId,
          value: commentVotes.value,
        })
        .from(commentVotes)
        .where(and(eq(commentVotes.userId, userId), inArray(commentVotes.commentId, commentIds)))
      : [];

  const statsByCommentId = new Map<number, { likes: number; dislikes: number }>();
  for (const row of voteStats) {
    statsByCommentId.set(row.commentId, {
      likes: Number(row.likes ?? 0),
      dislikes: Number(row.dislikes ?? 0),
    });
  }

  const userVoteByCommentId = new Map<number, number>();
  for (const row of userVotes) {
    userVoteByCommentId.set(row.commentId, Number(row.value ?? 0));
  }

  const items = rows.map((row) => {
    const vote = statsByCommentId.get(row.id);
    return {
      ...row,
      username: row.username ?? "User",
      avatarUrl: resolveClientAssetUrl(row.avatarUrl) ?? null,
      parentCommentId: row.parentCommentId,
      likes: vote?.likes ?? 0,
      dislikes: vote?.dislikes ?? 0,
      myVote: userVoteByCommentId.get(row.id) ?? 0,
    };
  });

  return NextResponse.json({ items });
}

export const POST = withAuth(async (req, ctx) => {
  const body = await req.json().catch(() => null);
  const animeId = Number(body?.animeId);
  const content = String(body?.content ?? "").trim();
  const parentCommentIdRaw = body?.parentCommentId;
  const parentCommentId =
    parentCommentIdRaw === null || parentCommentIdRaw === undefined
      ? null
      : Number(parentCommentIdRaw);

  if (!Number.isInteger(animeId)) {
    return NextResponse.json({ error: "Invalid animeId" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "Комментарий пустой" }, { status: 400 });
  }

  if (parentCommentId !== null && !Number.isInteger(parentCommentId)) {
    return NextResponse.json({ error: "Invalid parentCommentId" }, { status: 400 });
  }

  if (content.length > MAX_COMMENT_LEN) {
    return NextResponse.json(
      { error: `Комментарий слишком длинный (максимум ${MAX_COMMENT_LEN} символов)` },
      { status: 400 }
    );
  }

  const me = await db.query.users.findFirst({
    where: eq(users.id, ctx.userId),
    columns: { username: true, avatarUrl: true, commentBanUntil: true },
  });

  const now = Date.now();
  const banUntil = me?.commentBanUntil ? new Date(me.commentBanUntil).getTime() : 0;
  if (banUntil > now) {
    return NextResponse.json(
      { error: `Вы не можете писать комментарии до ${new Date(banUntil).toLocaleString("ru-RU")}` },
      { status: 403 }
    );
  }

  if (parentCommentId !== null) {
    const parent = await db.query.comments.findFirst({
      where: and(
        eq(comments.id, parentCommentId),
        eq(comments.animeId, animeId),
        eq(comments.isDeleted, false)
      ),
      columns: { id: true },
    });

    if (!parent) {
      return NextResponse.json({ error: "Родительский комментарий не найден" }, { status: 404 });
    }
  }

  const sanitized = sanitizeCommentText(content);

  const [inserted] = await db
    .insert(comments)
    .values({
      animeId,
      userId: ctx.userId,
      parentCommentId,
      content: sanitized,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: comments.id,
      animeId: comments.animeId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      parentCommentId: comments.parentCommentId,
    });

  return NextResponse.json({
    item: {
      ...inserted,
      userId: ctx.userId,
      username: me?.username ?? "User",
      avatarUrl: resolveClientAssetUrl(me?.avatarUrl) ?? null,
      parentCommentId: inserted.parentCommentId,
      likes: 0,
      dislikes: 0,
      myVote: 0,
    },
  });
});
