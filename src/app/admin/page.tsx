// src/app/admin/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin") redirect("/");

  return <AdminClient />;
}
