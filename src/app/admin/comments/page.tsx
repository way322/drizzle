import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/authOptions";
import AdminSectionNav from "../AdminSectionNav";
import AdminCommentsClient from "@/app/admin/comments/AdminCommentsClient";

export default async function AdminCommentsPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin") redirect("/");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070d]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.14),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.12]" />
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="absolute top-32 right-[6%] h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 px-4 pb-12 pt-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-purple-200 backdrop-blur-md">
              Админ-панель
            </div>
            <h1 className="mt-4 text-4xl font-bold text-white">Модерация комментариев</h1>
            <p className="mt-2 max-w-2xl text-gray-300">
              Обработка комментариев с жалобами, удаление нарушений и временные баны.
            </p>
          </div>

          <AdminSectionNav active="comments" />

        <AdminCommentsClient />
        </div>
      </div>
    </div>
  );
}
