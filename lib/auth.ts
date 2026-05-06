import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
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
  // PrismaAdapter writes OAuth account links to the Account table.
  // With JWT session strategy it does NOT write sessions — sessions stay stateless.
  adapter: PrismaAdapter(prisma),
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
          agencyId: user.agencyId ?? "",
          firmName: user.firmName ?? null,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Google verifies email ownership before issuing tokens, so linking to an
      // existing email/password account is safe.
      allowDangerousEmailAccountLinking: true,
    }),

    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID,
      // Microsoft verifies email ownership before issuing tokens.
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Credentials: always allow — authorize() already validated email+password.
      if (account?.provider === "credentials") {
        return true;
      }

      // OAuth: allow through. If a matching email/password account exists it will
      // be linked via allowDangerousEmailAccountLinking. If this is a net-new OAuth
      // user, the PrismaAdapter creates a User row but with no role/agencyId — that
      // broken state is handled in Phase A4 (onboarding gate). Allowing through here
      // keeps A2 simple and unblocks round-trip smoke testing.
      // TODO (Phase A4): redirect net-new OAuth users to complete their signup.
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;

        if (account?.provider === "credentials") {
          // Credentials: authorize() already fetched role/agencyId/firmName.
          token.role = (user as { role: UserRole }).role;
          token.agencyId = (user as { agencyId: string | null }).agencyId ?? "";
          token.firmName = (user as { firmName: string | null }).firmName;
        } else if (account) {
          // OAuth: the user object only has id/name/email/image from the provider.
          // Fetch role/agencyId/firmName from the database.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, agencyId: true, firmName: true },
          });
          token.role = dbUser?.role ?? "viewer";
          token.agencyId = dbUser?.agencyId ?? "";
          token.firmName = dbUser?.firmName ?? null;
        }
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
