import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/auth/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { lockoutMinutesLeft, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { sendWelcomeEmail } from "@/lib/welcome-email";

/**
 * Auth.js setup.
 *
 * - Email + password (bcrypt) and Google sign-in.
 * - Sessions are signed JWT cookies. Every protected page/action re-checks the
 *   user in the database (see src/lib/auth/dal.ts), so role changes and
 *   password resets take effect immediately.
 * - STAFF/ADMIN must use email + password + a 6-digit authenticator code;
 *   they can't sign in with Google, since Google can't ask for the code.
 */

// Error codes the login form turns into friendly messages. They end up in a
// URL, so they never say whether it was the email or the password that was wrong.
class InvalidLogin extends CredentialsSignin {
  code = "invalid";
}
class LockedOut extends CredentialsSignin {
  code = "locked";
}
class EmailNotVerified extends CredentialsSignin {
  code = "unverified";
}
class CodeRequired extends CredentialsSignin {
  code = "code_required";
}
class InvalidCode extends CredentialsSignin {
  code = "code_invalid";
}

const credentialsSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
  code: z
    .string()
    .optional()
    .transform((c) => c?.replace(/\s/g, "") || undefined),
});

// Compared against when the email doesn't exist, so the response takes the same
// time either way and doesn't reveal which emails have accounts.
const DUMMY_HASH = "$2b$12$ls917mu1DrMhyXYjH.OMdO9qcTCiX7ifnYFrONMbaE3VrWxd.RNL2";

export const isStaffRole = (role: string) => role === "ADMIN" || role === "STAFF";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  logger: {
    // A wrong password or a pending 2FA code is normal, not a server error —
    // skip those so real problems stand out in the logs.
    error(error) {
      if ((error as { type?: string }).type === "CredentialsSignin") return;
      console.error(error);
    },
  },
  providers: [
    Google({
      // Google has already confirmed the address, so link it to an existing
      // account with the same email (see the linkAccount event for the safety step).
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();
        const { email, password, code } = parsed.data;
        const ip = request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

        if ((await lockoutMinutesLeft(email)) > 0) throw new LockedOut();

        const user = await prisma.user.findUnique({ where: { email } });
        const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !user.passwordHash || !passwordOk) {
          await recordLoginAttempt(email, false, ip);
          throw new InvalidLogin();
        }

        if (!user.emailVerified) throw new EmailNotVerified();

        // Staff with 2FA set up must also give a valid authenticator code.
        // Staff who haven't set it up yet get in, but can only reach the 2FA
        // setup page until they do (enforced by requireStaff()).
        let mfa = false;
        if (isStaffRole(user.role) && user.twoFactorEnabled && user.twoFactorSecret) {
          if (!code) throw new CodeRequired();
          const step = verifyTotp(decrypt(user.twoFactorSecret), code, user.twoFactorLastStep);
          if (step === null) {
            await recordLoginAttempt(email, false, ip);
            throw new InvalidCode();
          }
          await prisma.user.update({ where: { id: user.id }, data: { twoFactorLastStep: step } });
          mfa = true;
        }

        await recordLoginAttempt(email, true, ip);
        return { id: user.id, email: user.email, name: user.name, mfa };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email_verified) return "/login?error=GoogleUnverified";
      const existing = user.email
        ? await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } })
        : null;
      if (existing && isStaffRole(existing.role)) return "/login?error=StaffUsePassword";
      return true;
    },
    async jwt({ token, user, account }) {
      // Only set on sign-in. Client-side session "update" calls are ignored on
      // purpose, so nobody can flip their own role or 2FA flag.
      if (user?.id) {
        const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.sv = dbUser.sessionVersion;
        token.mfa = account?.provider === "credentials" && user.mfa === true;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as Role;
      session.user.mfa = token.mfa === true;
      session.user.sv = token.sv as number;
      return session;
    },
  },
  events: {
    // A brand-new account made by signing in with Google (password sign-ups get theirs after confirming their email).
    async createUser({ user }) {
      if (user.email) await sendWelcomeEmail({ email: user.email, name: user.name ?? null });
    },
    async linkAccount({ user }) {
      // Google proves ownership of the email. If the account was created with a
      // password but never confirmed, that password may have been set by someone
      // else — so remove it and sign out any other sessions.
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (dbUser && !dbUser.emailVerified) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            emailVerified: new Date(),
            passwordHash: null,
            sessionVersion: { increment: dbUser.passwordHash ? 1 : 0 },
          },
        });
      }
    },
  },
});
