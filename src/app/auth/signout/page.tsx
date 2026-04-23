"use client";

import { Suspense, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LogOut, ShieldQuestion, User } from "lucide-react";

function SignOutContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const userName = session?.user?.name || "Пользователь";
  const userEmail = session?.user?.email || "Email не указан";

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut({ callbackUrl });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070d]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.14),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.12]" />
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-32 right-[6%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pt-28 pb-10">
        <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-white/8 p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/25">
              <LogOut className="h-10 w-10 text-white" />
            </div>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
              <ShieldQuestion className="h-4 w-4" />
              Подтверждение действия
            </div>

            <h1 className="text-3xl font-bold text-white">Выйти из аккаунта?</h1>
            <p className="mt-3 text-gray-300">
              Текущая сессия будет завершена, и ты вернёшься на главную страницу.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600">
                  {status === "authenticated" && session?.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={userName}
                      width={48}
                      height={48}
                      className="h-12 w-12 object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-white" />
                  )}
                </div>

                <div className="min-w-0 text-left">
                  <div className="truncate font-semibold text-white">
                    {status === "loading" ? "Загрузка..." : userName}
                  </div>
                  <div className="truncate text-sm text-gray-400">
                    {status === "loading" ? "Получаю данные аккаунта..." : userEmail}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-4 font-semibold text-white shadow-lg shadow-red-500/25 transition hover:from-red-600 hover:to-pink-600 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Выход...
                  </>
                ) : (
                  <>
                    <LogOut className="h-5 w-5" />
                    Подтвердить выход
                  </>
                )}
              </button>

              <Link
                href={callbackUrl}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-6 py-4 font-semibold text-white transition hover:bg-white/12"
              >
                <ArrowLeft className="h-5 w-5" />
                Отмена
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignOutPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen overflow-hidden bg-[#07070d] flex items-center justify-center text-gray-300">
          Загрузка…
        </div>
      }
    >
      <SignOutContent />
    </Suspense>
  );
}
