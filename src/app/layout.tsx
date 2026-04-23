import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Kitsune - Веб-библиотека аниме",
  description: "Умная платформа для коллекционирования и обсуждения аниме",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-gray-900 text-white antialiased">
        <Providers>
          <Header /> 
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}