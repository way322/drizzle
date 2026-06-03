"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { AlertTriangle, ThumbsDown, ThumbsUp } from "lucide-react";
import CommentContent from "./CommentContent";

type CommentItem = {
  id: number;
  animeId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
  likes: number;
  dislikes: number;
  myVote: number;
  parentCommentId: number | null;
};

type Props = {
  animeId: number;
  userId: number | null;
  isAdmin: boolean;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const err = new Error("AUTH_REQUIRED");
    (err as Error & { code?: string }).code = "AUTH_REQUIRED";
    throw err;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      (payload && typeof payload.error === "string" && payload.error) ||
      (await res.text().catch(() => "")) ||
      "Ошибка запроса";
    throw new Error(message);
  }

  return res.json().catch(() => ({}));
}

export default function AnimeComments({ animeId, userId, isAdmin }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [submitting, startSubmitting] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  const query = useMemo(() => {
    const sp = new URLSearchParams({ animeId: String(animeId) });
    if (Number.isSafeInteger(userId)) sp.set("userId", String(userId));
    return sp.toString();
  }, [animeId, userId]);

  const redirectToLogin = () => {
    const callbackUrl = encodeURIComponent(pathname || "/");
    router.push(`/auth/login?callbackUrl=${callbackUrl}`);
  };

  const loadComments = async () => {
    setLoading(true);
    const res = await fetch(`/api/comments?${query}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onCreateComment = () => {
    setMessage(null);
    setError(null);

    const value = text.trim();
    if (!value) return;

    startSubmitting(async () => {
      try {
        const payload = await postJson("/api/comments", {
          animeId,
          content: value,
          parentCommentId: null,
        });
        if (payload?.item) {
          setItems((prev) => [...prev, payload.item as CommentItem]);
          setText("");
          setMessage("Комментарий добавлен");
        } else {
          await loadComments();
          setText("");
          setMessage("Комментарий добавлен");
        }
      } catch (e) {
        if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
          redirectToLogin();
          return;
        }
        setError(e instanceof Error ? e.message : "Не удалось добавить комментарий");
      }
    });
  };

  const onCreateReply = (parentCommentId: number) => {
    setMessage(null);
    setError(null);

    const value = (replyText[parentCommentId] ?? "").trim();
    if (!value) return;

    startSubmitting(async () => {
      try {
        const payload = await postJson("/api/comments", {
          animeId,
          content: value,
          parentCommentId,
        });
        if (payload?.item) {
          setItems((prev) => [...prev, payload.item as CommentItem]);
        } else {
          await loadComments();
        }
        setReplyText((prev) => ({ ...prev, [parentCommentId]: "" }));
        setReplyToId(null);
        setMessage("Ответ добавлен");
      } catch (e) {
        if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
          redirectToLogin();
          return;
        }
        setError(e instanceof Error ? e.message : "Не удалось добавить ответ");
      }
    });
  };

  const onVote = async (commentId: number, nextVote: -1 | 1) => {
    setMessage(null);
    setError(null);

    const current = items.find((x) => x.id === commentId)?.myVote ?? 0;
    const sendVote = current === nextVote ? 0 : nextVote;

    try {
      await postJson("/api/comments/vote", { commentId, value: sendVote });
      await loadComments();
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
        redirectToLogin();
        return;
      }
      setError(e instanceof Error ? e.message : "Не удалось поставить голос");
    }
  };

  const onReport = async (commentId: number) => {
    setMessage(null);
    setError(null);

    const reason = window.prompt("Причина жалобы (необязательно):", "") ?? "";
    try {
      await postJson("/api/comments/report", { commentId, reason });
      setMessage("Жалоба отправлена администратору");
    } catch (e) {
      if ((e as Error & { code?: string })?.code === "AUTH_REQUIRED") {
        redirectToLogin();
        return;
      }
      setError(e instanceof Error ? e.message : "Не удалось отправить жалобу");
    }
  };

  const submitOnEnter = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    submit: () => void
  ) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  };

  const canManage = (item: CommentItem) =>
    Number.isSafeInteger(userId) && (item.userId === userId || isAdmin);

  const startEdit = (item: CommentItem) => {
    setEditingId(item.id);
    setEditingText(item.content);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setMessage(null);
    setError(null);
    const value = editingText.trim();
    if (!value) return;

    const res = await fetch(`/api/comments/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не удалось изменить комментарий");
      return;
    }
    setEditingId(null);
    setEditingText("");
    await loadComments();
    setMessage("Комментарий обновлён");
  };

  const deleteComment = async (commentId: number) => {
    if (!confirm("Удалить комментарий?")) return;
    setMessage(null);
    setError(null);

    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Не удалось удалить комментарий");
      return;
    }
    await loadComments();
    setMessage("Комментарий удалён");
  };

  const renderThread = (parentId: number | null, level = 0) => {
    const children = items.filter((x) => x.parentCommentId === parentId);
    return children.map((item) => (
      <div key={item.id} className={level > 0 ? "ml-4 mt-3 border-l border-white/10 pl-4" : ""}>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {item.avatarUrl ? (
                <Image
                  src={item.avatarUrl}
                  alt={item.username}
                  width={28}
                  height={28}
                  unoptimized
                  className="h-7 w-7 rounded-full border border-white/15 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] text-white">
                  {(item.username || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="text-sm font-medium text-white">{item.username}</div>
            </div>
            <div className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString("ru-RU")}</div>
          </div>
          {editingId === item.id ? (
            <div>
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  className="rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditingText("");
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <CommentContent content={item.content} />
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onVote(item.id, 1)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs transition ${
                item.myVote === 1
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> {item.likes}
            </button>

            <button
              type="button"
              onClick={() => onVote(item.id, -1)}
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs transition ${
                item.myVote === -1
                  ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
                  : "border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> {item.dislikes}
            </button>

            <button
              type="button"
              onClick={() => onReport(item.id)}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/20"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Репорт
            </button>

            {canManage(item) && item.userId === userId && editingId !== item.id && (
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="inline-flex items-center gap-1 rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-100 transition hover:bg-blue-500/20"
              >
                Изменить
              </button>
            )}

            {canManage(item) && (
              <button
                type="button"
                onClick={() => deleteComment(item.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/20"
              >
                Удалить
              </button>
            )}

            <button
              type="button"
              onClick={() => setReplyToId((prev) => (prev === item.id ? null : item.id))}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
            >
              Ответить
            </button>
          </div>

          {replyToId === item.id && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <textarea
                value={replyText[item.id] ?? ""}
                onChange={(e) =>
                  setReplyText((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => submitOnEnter(e, () => onCreateReply(item.id))}
                rows={3}
                maxLength={1000}
                placeholder="Напиши ответ..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-gray-500 focus:border-purple-400/50"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplyToId(null)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-gray-200 transition hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => onCreateReply(item.id)}
                  disabled={submitting}
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:from-purple-700 hover:to-violet-700 disabled:opacity-60"
                >
                  Ответить
                </button>
              </div>
            </div>
          )}
        </div>
        {renderThread(item.id, level + 1)}
      </div>
    ));
  };

  return (
    <div className="mt-8 rounded-[28px] border border-white/10 bg-black/20 p-5">
      <div className="mb-2 text-xl font-semibold text-white">Комментарии</div>
      <div className="mb-4 text-sm text-gray-400">
        Можно поставить лайк/дизлайк и отправить жалобу на комментарий
      </div>

      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => submitOnEnter(e, onCreateComment)}
          rows={4}
          maxLength={1000}
          placeholder="Напиши комментарий..."
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-400/50"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-400">{text.length}/1000</div>
          <button
            type="button"
            onClick={onCreateComment}
            disabled={submitting}
            className="rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-violet-700 disabled:opacity-60"
          >
            {submitting ? "Отправка..." : "Добавить"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-gray-300">
          Загрузка комментариев...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-gray-300">
          Пока нет комментариев.
        </div>
      ) : <div className="space-y-3">{renderThread(null)}</div>}

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}
    </div>
  );
}
