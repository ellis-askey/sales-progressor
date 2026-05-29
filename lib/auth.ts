import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import AzureADProvider from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkAuthLimit } from "@/lib/ratelimit";
import type { UserRole } from "@prisma/client";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { recordEvent } from "@/lib/command/events/write";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      agencyId: string;
      firmName: string | null;
      needsSignupCompletion: boolean;
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
    needsSignupCompletion: boolean;
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
        void trackServerEvent(user.id, ANALYTICS_EVENTS.USER_SIGNED_IN, {
          provider: "credentials",
          agencyId: user.agencyId ?? undefined,
        });
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

      // OAuth: always allow the sign-in to complete. We do NOT gate incomplete
      // users here because returning false from signIn would show NextAuth's
      // generic error page with no clear path forward. Instead we set
      // needsSignupCompletion: true in the jwt callback, and requireSession()
      // redirects those users to /signup/complete — a branded page they can
      // actually act on. This is intentional; don't add role/agencyId checks here.
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
          token.needsSignupCompletion = false;
        } else if (account) {
          // OAuth: fetch role/agencyId/firmName from DB.
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, agencyId: true, firmName: true },
          });
          token.role = dbUser?.role ?? "viewer";
          token.agencyId = dbUser?.agencyId ?? "";
          token.firmName = dbUser?.firmName ?? null;
          // viewer + no agencyId = net-new OAuth user who hasn't completed signup
          token.needsSignupCompletion = !dbUser?.agencyId && dbUser?.role === "viewer";
        }

        // Command Centre event log — fires only on initial sign-in (when
        // `user` is present), not on subsequent JWT refreshes.
        await recordEvent({
          type: "user_logged_in",
          userId: user.id,
          agencyId: token.agencyId || undefined,
          isInternalUser:
            token.role === "admin" ||
            token.role === "superadmin" ||
            token.role === "sales_progressor",
          metadata: { provider: account?.provider ?? "credentials" },
        });
      }

      // On every request: if signup is still incomplete, re-check the DB.
      // This picks up the completion (agencyId now set) without requiring a
      // new sign-in. The updated token is written back into the JWT cookie,
      // so middleware sees the correct role on the next request.
      if (token.needsSignupCompletion && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, agencyId: true, firmName: true },
        });
        if (dbUser?.agencyId) {
          token.role = dbUser.role;
          token.agencyId = dbUser.agencyId;
          token.firmName = dbUser.firmName ?? null;
          token.needsSignupCompletion = false;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.agencyId = token.agencyId;
      session.user.firmName = token.firmName;
      session.user.needsSignupCompletion = token.needsSignupCompletion ?? false;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  logger: {
    error(code, ...message) {
      console.error("[NEXTAUTH_ERROR]", code, JSON.stringify(message));
    },
    warn(code) {
      console.warn("[NEXTAUTH_WARN]", code);
    },
  },
};

export default NextAuth(authOptions);
