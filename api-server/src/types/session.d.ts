import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    tenantId: number;
    role: "admin" | "client";
    name: string;
    email: string;
    plan: string;
    planExpiresAt: string | null;
  }
}
