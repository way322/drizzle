import RegisterForm from "./RegisterForm";
import SocialButtons from "../components/SocialButtons";
import {
  hasAnyOAuthProvider,
  isGoogleOAuthConfigured,
  isYandexOAuthConfigured,
} from "@/lib/oauth";
import Link from "next/link";
import Image from "next/image";

export default function RegisterPage() {
  const oauthEnabled = hasAnyOAuthProvider();
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
        <div className="w-full max-w-md">
          <div className="rounded-[32px] border border-white/15 bg-white/8 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center">


              <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25">
                <Image src="/fox.png" alt="Kitsune" width={32} height={32} className="w-8 h-8" />
              </div>

              <h1 className="text-3xl font-bold text-white mb-2">Регистрация</h1>
              <p className="text-gray-300">Создайте аккаунт в Kitsune</p>
            </div>

            <RegisterForm />

            {oauthEnabled && (
              <>
                <div className="my-6 flex items-center">
                  <div className="h-px flex-1 bg-white/15" />
                  <span className="px-4 text-sm text-gray-400">или</span>
                  <div className="h-px flex-1 bg-white/15" />
                </div>

                <SocialButtons
                  showGoogle={isGoogleOAuthConfigured()}
                  showYandex={isYandexOAuthConfigured()}
                />
              </>
            )}

            <div className="mt-8 text-center">
              <p className="text-gray-400">
                Уже есть аккаунт?{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-purple-300 transition-colors hover:text-white"
                >
                  Войти
                </Link>
              </p>

              <Link
                href="/"
                className="mt-4 inline-block text-gray-500 transition-colors hover:text-white"
              >
                ← Вернуться на главную
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}