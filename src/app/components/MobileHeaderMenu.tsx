"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Shield,
  User,
  UserPlus,
  X,
} from "lucide-react";
import HeaderSearch from "./HeaderSearch";

type Props = {
  isAuthed: boolean;
  isAdmin: boolean;
};

type MenuLink = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export default function MobileHeaderMenu({ isAuthed, isAdmin }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = useMemo<MenuLink[]>(() => {
    const items: MenuLink[] = [{ href: "/catalog", label: "Каталог", icon: LayoutGrid }];

    if (isAdmin) {
      items.push({ href: "/admin", label: "Админка", icon: Shield });
    }

    if (isAuthed) {
      items.push({ href: "/profile", label: "Профиль", icon: User });
      items.push({
        href: "/auth/signout?callbackUrl=/",
        label: "Выход",
        icon: LogOut,
      });
    } else {
      items.push({ href: "/auth/login", label: "Вход", icon: LogIn });
      items.push({ href: "/auth/register", label: "Регистрация", icon: UserPlus });
    }

    return items;
  }, [isAdmin, isAuthed]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-white backdrop-blur-md transition hover:bg-white/12"
        aria-expanded={open}
        aria-controls="mobile-header-menu"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#05050a]/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
          />

          <div
            id="mobile-header-menu"
            className="fixed inset-x-4 top-20 z-50 overflow-hidden rounded-[28px] border border-white/12 bg-[#0b0b14]/95 p-3 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-2 px-2 text-xs uppercase tracking-[0.22em] text-gray-400">
              Меню
            </div>

            <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
              <HeaderSearch />
            </div>

            <nav className="space-y-2">
              {links.map((link) => {
                const Icon = link.icon;
                const active =
                  !link.href.startsWith("/auth/signout") &&
                  (pathname === link.href || pathname.startsWith(`${link.href}/`));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white transition ${
                      active
                        ? "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 ring-1 ring-purple-400/30"
                        : "bg-white/[0.04] hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
