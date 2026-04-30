"use client";

import { useEffect, useState } from "react";

type ModerationComment = {
  id: number;
  animeId: number;
  animeTitle: string;
  userId: number;
  username: string | null;
  content: string;
  parentCommentId: number | null;
  createdAt: string;
  reportCount: number;
};

export default function AdminCommentsClient() {
  const [items, setItems] = useState<ModerationComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/comments", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const deleteComment = async (commentId: number) => {
    if (!confirm("Удалить комментарий?")) return;
    setBusyKey(`delete:${commentId}`);
    const res = await fetch(`/api/admin/comments?commentId=${commentId}`, {
      method: "DELETE",
    });
    setBusyKey(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка удаления");
      return;
    }
    await load();
  };

  const banUser = async (userId: number, days: 1 | 7 | 14) => {
    if (!confirm(`Забанить пользователя #${userId} на комментарии на ${days} дн.?`)) return;
    setBusyKey(`ban:${userId}:${days}`);
    const res = await fetch("/api/admin/comments/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, days }),
    });
    setBusyKey(null);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка бана");
      return;
    }

    alert(`Пользователь #${userId} забанен на ${days} дн.`);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-gray-300">
        Загрузка комментариев...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-gray-300">
        Комментариев для модерации пока нет.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-sm text-gray-400">
            Комментарий #{item.id} | Пользователь #{item.userId} ({item.username ?? "User"})
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Тайтл #{item.animeId}: {item.animeTitle}
            {item.parentCommentId ? ` | Ответ на #${item.parentCommentId}` : ""}
            {` | Жалоб: ${item.reportCount}`}
          </div>
          <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-200">
            {item.content}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => deleteComment(item.id)}
              disabled={busyKey === `delete:${item.id}`}
              className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-3 py-2 text-sm font-semibold text-white transition hover:from-red-600 hover:to-pink-600 disabled:opacity-60"
            >
              Удалить
            </button>

            <button
              type="button"
              onClick={() => banUser(item.userId, 1)}
              disabled={busyKey === `ban:${item.userId}:1`}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
            >
              Бан 1 день
            </button>

            <button
              type="button"
              onClick={() => banUser(item.userId, 7)}
              disabled={busyKey === `ban:${item.userId}:7`}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
            >
              Бан 7 дней
            </button>

            <button
              type="button"
              onClick={() => banUser(item.userId, 14)}
              disabled={busyKey === `ban:${item.userId}:14`}
              className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-60"
            >
              Бан 14 дней
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
