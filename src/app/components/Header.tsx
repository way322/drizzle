// src/app/components/Header.tsx
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "../../app/api/auth/[...nextauth]/route";
import HeaderSearch from "./HeaderSearch";
import MobileHeaderMenu from "./MobileHeaderMenu";

export default async function Header() {
  const session = await getServerSession(authOptions);
  const isAuthed = !!session;
  const isAdmin = session?.user?.role === "admin";

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-[#07070d]/72 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-4 md:gap-6">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-violet-600 rounded-lg flex items-center justify-center">
            <Image src="/fox.png" alt="Kitsune Logo" width={24} height={24} />
          </div>
          <span className="text-2xl font-bold text-white">Kitsune</span>
        </Link>

        <div className="hidden flex-1 justify-center md:flex">
          <HeaderSearch />
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/catalog" className="text-white hover:text-purple-400 transition-colors">
            Каталог
          </Link>

          {isAdmin && (
            <Link href="/admin" className="text-white hover:text-purple-400 transition-colors">
              Админка
            </Link>
          )}

          {isAuthed ? (
            <>
              <Link href="/profile" className="text-white hover:text-purple-400 transition-colors">
                Профиль
              </Link>
              <Link
                href="/api/auth/signout?callbackUrl=/"
                className="text-white hover:text-purple-400 transition-colors"
              >
                Выход
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-white hover:text-purple-400 transition-colors">
                Вход
              </Link>
              <Link
                href="/auth/register"
                className="text-white hover:text-purple-400 transition-colors"
              >
                Регистрация
              </Link>
            </>
          )}
        </nav>

        <div className="ml-auto md:hidden">
          <MobileHeaderMenu isAuthed={isAuthed} isAdmin={isAdmin} />
        </div>
      </div>

    </header>
  );
}