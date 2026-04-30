"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const errorMessage = useMemo(() => {
    const messages: Record<string, string> = {
      OAuthSignin: "Ошибка при попытке входа через социальную сеть",
      OAuthCallback: "Ошибка при обработке ответа от социальной сети",
      OAuthCreateAccount: "Ошибка при создании аккаунта через социальную сеть",
      EmailCreateAccount: "Ошибка при создании аккаунта через email",
      Callback: "Ошибка при обработке callback",
      OAuthAccountNotLinked: "Этот email уже используется другим способом входа",
      EmailSignin: "Ошибка при отправке email",
      CredentialsSignin: "Неверный email или пароль",
      SessionRequired: "Требуется войти в аккаунт",
      Default: "Произошла ошибка при аутентификации",
    };
    return error && messages[error] ? messages[error] : messages.Default;
  }, [error]);

  const handleRetry = () => {
    router.back();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="w-full max-w-md space-y-8 p-8 bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 shadow-2xl">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Ошибка</h1>
          <p className="text-gray-300 mb-6">При аутентификации произошла ошибка</p>

          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-8">
            <p className="text-red-200 font-medium">{errorMessage}</p>
            {error && (
              <p className="text-red-300 text-sm mt-2">Код ошибки: {error}</p>
            )}
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white py-3 rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-semibold"
            >
              Попробовать снова
            </button>

            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/auth/login"
                className="py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-center hover:bg-white/20 transition-all duration-300"
              >
                <span className="text-white font-medium">Вход</span>
              </Link>

              <Link
                href="/auth/register"
                className="py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-center hover:bg-white/20 transition-all duration-300"
              >
                <span className="text-white font-medium">Регистрация</span>
              </Link>
            </div>

            <Link
              href="/"
              className="block py-3 text-center text-gray-400 hover:text-white transition-colors duration-300"
            >
              ← Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 text-gray-300">
          Загрузка…
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
