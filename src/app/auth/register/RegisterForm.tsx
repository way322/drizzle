"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";

export default function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!acceptedPolicy) {
      setError("Необходимо принять политику пользователя и согласие на обработку данных");
      return;
    }

    setIsLoading(true);

    const form = e.currentTarget as HTMLFormElement;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка при создании аккаунта. Попробуйте снова.");
        setIsLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Ошибка при входе после регистрации");
        setIsLoading(false);
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch (err) {
      console.error("Ошибка регистрации:", err);
      setError("Внутренняя ошибка сервера. Пожалуйста, попробуйте позже.");
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-2 text-red-200">
            <div className="w-6 h-6 bg-red-500/30 rounded-full flex items-center justify-center">
              <span className="text-sm">!</span>
            </div>
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Имя пользователя</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-400 transition-colors duration-300" />
            <input
              name="username"
              type="text"
              placeholder="Введите ваше имя"
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all duration-300"
              required
              minLength={3}
              maxLength={50}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Email</label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-400 transition-colors duration-300" />
            <input
              name="email"
              type="email"
              placeholder="your.email@example.com"
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all duration-300"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-gray-300">Пароль</label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-sm text-purple-300 hover:text-white transition-colors duration-300"
            >
              {showPassword ? "Скрыть" : "Показать"}
            </button>
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-purple-400 transition-colors duration-300" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Придумайте надежный пароль"
              className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all duration-300"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5 text-gray-400 hover:text-white transition-colors duration-300" />
              ) : (
                <Eye className="w-5 h-5 text-gray-400 hover:text-white transition-colors duration-300" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500">Минимум 6 символов</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(e) => setAcceptedPolicy(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 accent-purple-500"
          />
          <span className="text-sm leading-6 text-gray-300">
            Я соглашаюсь с{" "}
            <Link
              href="/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-purple-300 underline underline-offset-2 transition hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              политикой пользователя
            </Link>{" "}
            и даю согласие на обработку персональных данных
          </span>
        </label>

        <p className="text-center text-xs leading-5 text-gray-500">
          Ваши данные защищены и не передаются третьим лицам.{" "}
          <Link
            href="/legal/security"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-purple-300 underline underline-offset-2 transition hover:text-white"
          >
            Подробнее о безопасности
          </Link>
        </p>

        <button
          type="submit"
          disabled={isLoading || !acceptedPolicy}
          className="w-full py-4 px-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-fuchsia-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-violet-500/25 flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Регистрация...</span>
            </>
          ) : (
            <>
              <span>Зарегистрироваться</span>
            </>
          )}
        </button>
      </form>
    </>
  );
}