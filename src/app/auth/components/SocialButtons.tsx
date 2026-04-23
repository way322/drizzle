"use client";

import { signIn } from "next-auth/react";
import Image from "next/image";

type Props = {
  showGoogle?: boolean;
  showYandex?: boolean;
};

export default function SocialButtons({
  showGoogle = false,
  showYandex = false,
}: Props) {
  if (!showGoogle && !showYandex) return null;

  const handleSocialLogin = (provider: string) => {
    signIn(provider, { callbackUrl: "/profile" });
  };

  const count = Number(showGoogle) + Number(showYandex);
  const gridClass = count === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {showGoogle && (
        <button
          type="button"
          onClick={() => handleSocialLogin("google")}
          className="group relative bg-white/10 border border-white/20 rounded-xl p-4 flex items-center justify-center gap-3 hover:bg-white/20 transition-all duration-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10"
        >
          <div className="relative w-6 h-6">
            <Image
              src="/google.png"
              alt="Google"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white font-medium group-hover:text-purple-200 transition-colors duration-300">
            Google
          </span>
        </button>
      )}

      {showYandex && (
        <button
          type="button"
          onClick={() => handleSocialLogin("yandex")}
          className="group relative bg-white/10 border border-white/20 rounded-xl p-4 flex items-center justify-center gap-3 hover:bg-white/20 transition-all duration-300 hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-500/10"
        >
          <div className="relative w-6 h-6">
            <Image
              src="/yandex.png"
              alt="Yandex"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white font-medium group-hover:text-yellow-200 transition-colors duration-300">
            Яндекс
          </span>
        </button>
      )}
    </div>
  );
}
