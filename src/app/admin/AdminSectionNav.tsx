import Link from "next/link";

type AdminSection = "anime" | "comments" | "player";

type Props = {
  active: AdminSection;
};

const sections: Array<{
  key: AdminSection;
  href: string;
  title: string;
  description: string;
}> = [
  {
    key: "anime",
    href: "/admin",
    title: "Создание аниме",
    description: "Тайтлы, жанры и постеры",
  },
  {
    key: "comments",
    href: "/admin/comments",
    title: "Модерация комментариев",
    description: "Репорты, удаления и баны",
  },
  {
    key: "player",
    href: "/admin/player",
    title: "Плеер и серии",
    description: "S3-видео, тайминги и озвучки",
  },
];

export default function AdminSectionNav({ active }: Props) {
  return (
    <div className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.06] p-2 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="grid gap-2 md:grid-cols-3">
        {sections.map((section) => {
          const isActive = active === section.key;

          return (
            <Link
              key={section.key}
              href={section.href}
              className={`rounded-[22px] border px-4 py-3 transition ${
                isActive
                  ? "border-purple-400/35 bg-gradient-to-br from-purple-500/25 to-violet-500/10 shadow-lg shadow-purple-500/10"
                  : "border-white/10 bg-black/10 hover:border-purple-300/30 hover:bg-white/[0.07]"
              }`}
            >
              <div
                className={`text-[11px] uppercase tracking-[0.18em] ${
                  isActive ? "text-purple-100" : "text-gray-500"
                }`}
              >
                Раздел
              </div>
              <div className="mt-1 text-base font-semibold text-white">{section.title}</div>
              <div className="mt-0.5 text-sm text-gray-400">{section.description}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
