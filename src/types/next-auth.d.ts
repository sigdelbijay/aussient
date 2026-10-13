import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    /** True when this sign-in included a valid authenticator code. */
    mfa?: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      mfa: boolean;
      sv: number;
    } & DefaultSession["user"];
  }
}
