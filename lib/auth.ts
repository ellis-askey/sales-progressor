import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthLimit } from "@/lib/ratelimit";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      agencyId: string;
      firmName: string | null;
    };
  }
  interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    agencyId: string;
    firmName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    agencyId: string;
    firmName: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const headers = req?.headers as Record<string, string | string[]> | undefined;
        const forwarded = headers?.["x-forwarded-for"];
        const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
          ?? (headers?.["x-real-ip"] as string | undefined)
          ?? "unknown";

        // Rate limit before credential check — prevents credential stuffing
        const rateLimit = await checkAuthLimit(ip).catch(() => ({ success: true, reset: 0, remaining: 5 }));
        if (!rateLimit.success) {
          console.log(`[AUDIT] login_rate_limited ip=${ip}`);
          return null;
        }

        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.password) {
          console.log(`[AUDIT] login_failed email=${credentials.email.toLowerCase().trim()} ip=${ip} reason=unknown_user`);
          return null;
        }

        const valid = await compare(credentials.password, user.password);
        if (!valid) {
          console.log(`[AUDIT] login_failed userId=${user.id} ip=${ip} reason=wrong_password`);
          return null;
        }

        console.log(`[AUDIT] login_success userId=${user.id} agencyId=${user.agencyId} ip=${ip}`);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          agencyId: user.agencyId,
          firmName: user.firmName ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.agencyId = (user as { agencyId: string }).agencyId;
        token.firmName = (user as { firmName: string | null }).firmName;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.agencyId = token.agencyId;
      session.user.firmName = token.firmName;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
};

export default NextAuth(authOptions);
