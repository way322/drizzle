import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import YandexProvider from "next-auth/providers/yandex";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { db } from "../server/db";
import { users } from "../server/db/schema";
import { isGoogleOAuthConfigured, isYandexOAuthConfigured } from "./oauth";
import { resolveClientAssetUrl } from "./s3";

type AppRole = "user" | "admin";
function toAppRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "user";
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null;

      const user = await db.query.users.findFirst({
        where: eq(users.email, credentials.email),
      });

      if (!user || !user.passwordHash) return null;

      const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!isValid) return null;
      return {
        id: String(user.id),
        email: user.email,
        name: user.username,
        image: resolveClientAssetUrl(user.avatarUrl) ?? null,
        role: toAppRole(user.role),
      };
    },
  }),
];

if (isGoogleOAuthConfigured()) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  );
}

if (isYandexOAuthConfigured()) {
  providers.push(
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/auth/login",
    signOut: "/auth/signout",
    error: "/auth/error",
    newUser: "/auth/register",
  },

  providers,

  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider !== "credentials") {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (!existingUser) {
          await db.insert(users).values({
            email: user.email,
            username: user.name ?? "fox",
            provider: account?.provider || "oauth",
            providerId: account?.providerAccountId,
            role: "user",
          });
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (account && user?.email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (dbUser) {
          token.id = String(dbUser.id);
          token.sub = String(dbUser.id);
          token.email = dbUser.email;
          token.name = dbUser.username;
          token.role = toAppRole(dbUser.role);
          token.image =
            resolveClientAssetUrl(dbUser.avatarUrl) ??
            resolveClientAssetUrl((user.image as string | null | undefined) ?? null) ??
            resolveClientAssetUrl((token.image as string | null | undefined) ?? null) ??
            null;
        }
      }

      token.image = resolveClientAssetUrl((token.image as string | null | undefined) ?? null) ?? null;

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.image =
          resolveClientAssetUrl((token.image as string | null | undefined) ?? null) ??
          session.user.image;
        session.user.role = toAppRole(token.role);
      }

      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
